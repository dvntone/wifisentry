package com.wifisentry.core

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteOpenHelper
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import net.sqlcipher.database.SupportFactory
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

// ── Room entities ─────────────────────────────────────────────────────────────

/**
 * OUI (Organizationally Unique Identifier) record stored in the encrypted database.
 *
 * The [prefix] is the first three BSSID octets without separators, upper-cased
 * (e.g. `"ACD75B"`), matching the format used by [OuiLookup].
 */
@Entity(tableName = "oui_entries")
data class OuiEntry(
    @PrimaryKey
    @ColumnInfo(name = "prefix")
    val prefix: String,

    @ColumnInfo(name = "manufacturer")
    val manufacturer: String,

    /** Timestamp (epoch ms) when this entry was ingested — used for TTL eviction. */
    @ColumnInfo(name = "ingested_at")
    val ingestedAt: Long = System.currentTimeMillis(),
)

/**
 * Telemetry record capturing a raw scan result for offline analysis.
 * Each row represents one [ScannedNetwork] observation at a point in time.
 */
@Entity(tableName = "telemetry")
data class TelemetryEntry(
    @PrimaryKey(autoGenerate = true)
    @ColumnInfo(name = "id")
    val id: Long = 0,

    @ColumnInfo(name = "ssid")
    val ssid: String,

    @ColumnInfo(name = "bssid")
    val bssid: String,

    @ColumnInfo(name = "capabilities")
    val capabilities: String,

    @ColumnInfo(name = "rssi")
    val rssi: Int,

    @ColumnInfo(name = "frequency")
    val frequency: Int,

    @ColumnInfo(name = "threats")
    val threats: String,         // JSON-encoded list of ThreatType names

    @ColumnInfo(name = "scanned_at")
    val scannedAt: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "latitude")
    val latitude: Double = Double.NaN,

    @ColumnInfo(name = "longitude")
    val longitude: Double = Double.NaN,
)

// ── DAOs ─────────────────────────────────────────────────────────────────────

/** Data Access Object for OUI prefix lookups. */
@Dao
interface OuiDao {

    /**
     * Look up the manufacturer name for a given 6-character hex OUI [prefix].
     * Returns null when the prefix is not in the database.
     */
    @Query("SELECT manufacturer FROM oui_entries WHERE prefix = :prefix LIMIT 1")
    suspend fun lookupManufacturer(prefix: String): String?

    /** Insert or replace an OUI entry — used during bulk import. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: OuiEntry)

    /** Bulk insert — replaces duplicates for efficient re-import. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entries: List<OuiEntry>)

    /** Total number of OUI entries stored. */
    @Query("SELECT COUNT(*) FROM oui_entries")
    suspend fun count(): Int

    /** Delete entries older than [cutoffMs] to enforce a TTL. */
    @Query("DELETE FROM oui_entries WHERE ingested_at < :cutoffMs")
    suspend fun deleteOlderThan(cutoffMs: Long)
}

/** Data Access Object for network telemetry records. */
@Dao
interface TelemetryDao {

    /** Insert a new telemetry record. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: TelemetryEntry)

    /** Bulk insert telemetry records. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<TelemetryEntry>)

    /** Return the most recent [limit] telemetry entries, newest first. */
    @Query("SELECT * FROM telemetry ORDER BY scanned_at DESC LIMIT :limit")
    suspend fun getRecent(limit: Int = 200): List<TelemetryEntry>

    /** Return telemetry entries for a specific BSSID (all history). */
    @Query("SELECT * FROM telemetry WHERE bssid = :bssid ORDER BY scanned_at DESC")
    suspend fun getByBssid(bssid: String): List<TelemetryEntry>

    /** Total row count. */
    @Query("SELECT COUNT(*) FROM telemetry")
    suspend fun count(): Long

    /** Delete records older than [cutoffMs] to prevent unbounded growth. */
    @Query("DELETE FROM telemetry WHERE scanned_at < :cutoffMs")
    suspend fun deleteOlderThan(cutoffMs: Long)
}

// ── Room database ─────────────────────────────────────────────────────────────

/**
 * Encrypted Room database for offline OUI lookups and network telemetry storage.
 *
 * ## Encryption
 * The database is encrypted with AES-256-CBC via SQLCipher.  The encryption key
 * is generated and stored inside the Android Keystore, with hardware-backed
 * (StrongBox) storage requested when the device supports it.
 *
 * Key derivation flow:
 * ```
 * Android Keystore (hardware-backed) → AES-256 SecretKey
 *     → key bytes → SQLCipher passphrase → AES-256 CBC encryption of .db file
 * ```
 *
 * ## WAL mode
 * Room enables WAL (Write-Ahead Logging) by default, providing high-throughput
 * concurrent reads without blocking writes — critical for real-time telemetry
 * ingestion.
 *
 * ## Usage
 * Obtain the singleton via [OuiDatabase.getInstance].  All DAO methods are
 * suspend functions; call them from [kotlinx.coroutines.Dispatchers.IO].
 */
@Database(
    entities = [OuiEntry::class, TelemetryEntry::class],
    version  = 1,
    exportSchema = false,
)
abstract class OuiDatabase : RoomDatabase() {

    abstract fun ouiDao(): OuiDao
    abstract fun telemetryDao(): TelemetryDao

    companion object {

        private const val DATABASE_NAME    = "wifisentry_oui.db"
        private const val KEYSTORE_ALIAS   = "WifiSentry_OuiDbKey"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val PREF_KEY_PASSPHRASE = "db_passphrase"

        @Volatile
        private var instance: OuiDatabase? = null

        /**
         * Return the singleton [OuiDatabase], creating and opening it on first call.
         *
         * Thread-safe; multiple callers will block until the first call completes.
         * Must be called from a coroutine or background thread because key generation
         * may involve hardware operations.
         */
        fun getInstance(context: Context): OuiDatabase {
            return instance ?: synchronized(this) {
                instance ?: buildDatabase(context.applicationContext).also { instance = it }
            }
        }

        private fun buildDatabase(context: Context): OuiDatabase {
            val passphrase: ByteArray = getOrCreateDatabaseKey(context)
            val factory: SupportSQLiteOpenHelper.Factory =
                SupportFactory(passphrase)

            return Room.databaseBuilder(context, OuiDatabase::class.java, DATABASE_NAME)
                .openHelperFactory(factory)
                // WAL mode is enabled by default in Room — explicitly calling
                // setJournalMode here to document the intent.
                .setJournalMode(JournalMode.WRITE_AHEAD_LOGGING)
                .fallbackToDestructiveMigration()
                .build()
        }

        // ── Android Keystore key management ──────────────────────────────

        /**
         * Retrieve an existing database key from the Android Keystore, or generate
         * a new AES-256 key if none exists.
         *
         * Hardware-backed (StrongBox) storage is requested first; the Keystore
         * automatically falls back to TEE-backed storage if StrongBox is unavailable,
         * matching OWASP MASTG recommendation for sensitive key storage.
         *
         * @param context  Application context (used for EncryptedSharedPreferences fallback).
         * @return  Raw key bytes (32 bytes for AES-256) used as the SQLCipher passphrase.
         */
        private fun getOrCreateDatabaseKey(context: Context): ByteArray {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

            if (!keyStore.containsAlias(KEYSTORE_ALIAS)) {
                generateNewKey(strongBox = true)
            }

            return try {
                extractKeyBytes(context, keyStore)
            } catch (_: Exception) {
                // Key may be inaccessible (e.g. new install after factory reset).
                // Regenerate and recreate the database.
                generateNewKey(strongBox = false)
                extractKeyBytes(context, KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) })
            }
        }

        /**
         * Generate a new AES-256 key in the Android Keystore.
         *
         * The key is configured with GCM block mode and no padding — these
         * settings satisfy [KeyGenParameterSpec] validation requirements.
         * Note: the key bytes serve only as a raw passphrase for SQLCipher,
         * which performs its own PBKDF2-based key derivation internally; no
         * direct Cipher operations are performed on this Keystore key.
         *
         * @param strongBox  When true, requests hardware-backed StrongBox storage.
         *                   Automatically falls back to TEE if StrongBox is absent.
         */
        private fun generateNewKey(strongBox: Boolean) {
            val keyGenSpec = KeyGenParameterSpec.Builder(
                KEYSTORE_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(false)
                .apply {
                    if (strongBox) {
                        try {
                            setIsStrongBoxBacked(true)
                        } catch (_: Exception) {
                            // setIsStrongBoxBacked not available on this API level — ignore
                        }
                    }
                }
                .build()

            try {
                KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
                    .apply { init(keyGenSpec) }
                    .generateKey()
            } catch (_: Exception) {
                // StrongBox unavailable — retry without it
                if (strongBox) generateNewKey(strongBox = false)
            }
        }

        /**
         * Extract the raw key bytes from a [SecretKey] in the Keystore.
         *
         * When the Keystore key is hardware-backed (StrongBox / TEE) and truly
         * non-extractable — [SecretKey.getEncoded] returns null — a randomly
         * generated 32-byte passphrase is persisted in [EncryptedSharedPreferences]
         * (itself Keystore-protected).  This produces a unique, device-specific
         * value without relying on a predictable constant.
         *
         * @param context  Application context for [EncryptedSharedPreferences].
         * @param keyStore  Initialised [KeyStore] instance.
         */
        private fun extractKeyBytes(context: Context, keyStore: KeyStore): ByteArray {
            val entry = keyStore.getEntry(KEYSTORE_ALIAS, null) as? KeyStore.SecretKeyEntry
                ?: throw IllegalStateException("Keystore entry missing for alias $KEYSTORE_ALIAS")

            val encoded = entry.secretKey.encoded
            if (encoded != null && encoded.size >= 16) return encoded

            // Hardware-backed keys are non-extractable — use a randomly generated
            // passphrase stored securely in EncryptedSharedPreferences.
            return getOrGenerateEncryptedPassphrase(context)
        }

        /**
         * Return the database passphrase stored in [EncryptedSharedPreferences], or
         * generate and persist a new random 32-byte value if none exists.
         *
         * [EncryptedSharedPreferences] uses its own Keystore-backed AES-256-GCM
         * master key, so the passphrase is device-specific and encrypted at rest.
         */
        private fun getOrGenerateEncryptedPassphrase(context: Context): ByteArray {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            val prefs = EncryptedSharedPreferences.create(
                context,
                "wifisentry_db_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )

            val storedHex = prefs.getString(PREF_KEY_PASSPHRASE, null)
            if (storedHex != null) {
                return hexStringToByteArray(storedHex)
            }

            // Generate a new random passphrase and persist it
            val random = ByteArray(32).also { SecureRandom().nextBytes(it) }
            prefs.edit().putString(PREF_KEY_PASSPHRASE, byteArrayToHexString(random)).apply()
            return random
        }

        private fun byteArrayToHexString(bytes: ByteArray): String =
            bytes.joinToString("") { "%02x".format(it) }

        private fun hexStringToByteArray(hex: String): ByteArray =
            ByteArray(hex.length / 2) { hex.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
    }
}
