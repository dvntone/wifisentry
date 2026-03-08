package com.wifisentry.core

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.sqlcipher.database.SQLiteDatabaseHook
import net.sqlcipher.database.SupportFactory
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec

// ── Entity ────────────────────────────────────────────────────────────────────

/**
 * A single OUI-to-manufacturer mapping row in the encrypted local database.
 *
 * [oui] is the 6-character upper-case hex prefix (e.g. `"ACD75B"`) derived from
 * the first three octets of a BSSID.  [manufacturer] is the IEEE-registered name.
 */
@Entity(tableName = "oui_entries")
data class OuiEntry(
    @PrimaryKey
    val oui: String,
    val manufacturer: String,
)

// ── DAO ───────────────────────────────────────────────────────────────────────

/**
 * Data-access object for [OuiEntry] records.
 *
 * All queries are executed on a Room-managed background executor; callers should
 * use `suspend` functions or wrap in `withContext(Dispatchers.IO)`.
 */
@Dao
interface OuiDao {

    /** Look up the manufacturer name for the given [oui] prefix, or null if unknown. */
    @Query("SELECT manufacturer FROM oui_entries WHERE oui = :oui LIMIT 1")
    suspend fun lookupManufacturer(oui: String): String?

    /**
     * Insert or replace a batch of OUI entries.
     * Uses [OnConflictStrategy.REPLACE] so that refreshed database imports overwrite
     * stale records without requiring a DELETE-then-INSERT cycle.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<OuiEntry>)

    /** Returns the total number of OUI entries stored (useful for diagnostics). */
    @Query("SELECT COUNT(*) FROM oui_entries")
    suspend fun count(): Int

    /** Delete all OUI entries (used before a full database re-import). */
    @Query("DELETE FROM oui_entries")
    suspend fun deleteAll()
}

// ── Database ──────────────────────────────────────────────────────────────────

/**
 * Room database that stores the OUI-to-manufacturer mapping table.
 *
 * The database file is encrypted at rest using SQLCipher (AES-256) with a
 * randomly generated passphrase that is itself protected by an Android Keystore
 * AES-GCM key.
 *
 * Do not instantiate this class directly.  Use [OuiDatabaseManager.getInstance].
 */
@Database(entities = [OuiEntry::class], version = 1, exportSchema = true)
abstract class OuiDatabase : RoomDatabase() {
    abstract fun ouiDao(): OuiDao
}

// ── Manager ───────────────────────────────────────────────────────────────────

/**
 * Singleton manager that creates and holds the encrypted [OuiDatabase] instance.
 *
 * ## Security design (OWASP MASTG M9 — Insecure Data Storage)
 * The key hierarchy is:
 * ```
 * Android Keystore (AES-256-GCM, hardware-backed where available)
 *   └── encrypts → Database Passphrase (32 random bytes, in SharedPreferences)
 *         └── protects → SQLCipher database file (AES-256)
 * ```
 * - The Keystore key never leaves the secure hardware element.
 * - The raw database passphrase exists in memory only during `build()` and is
 *   zeroed immediately after the [SupportFactory] is initialised.
 * - On devices with a Titan M / StrongBox security element (Pixel 3+), the
 *   Keystore key is stored in dedicated tamper-resistant hardware.
 *   Otherwise it falls back to a TEE-backed key — both are secure here.
 *
 * ## WAL mode
 * Room's default journal mode is set to WAL (Write-Ahead Logging) for improved
 * write throughput when ingesting high-speed telemetry.
 */
object OuiDatabaseManager {

    private const val KEY_ALIAS         = "wifisentry_oui_key"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val DB_NAME           = "oui_encrypted.db"
    private const val PREFS_NAME        = "wifisentry_db_prefs"
    private const val PREF_PASSPHRASE   = "db_passphrase_enc"
    private const val PREF_IV           = "db_passphrase_iv"
    private const val AES_GCM_ALGO      = "AES/GCM/NoPadding"
    private const val GCM_TAG_LEN       = 128
    private const val PASSPHRASE_BYTES  = 32

    @Volatile
    private var instance: OuiDatabase? = null

    /**
     * Returns the singleton [OuiDatabase], creating it on first call.
     * Thread-safe; safe to call from any coroutine.
     */
    fun getInstance(context: Context): OuiDatabase {
        return instance ?: synchronized(this) {
            instance ?: build(context.applicationContext).also { instance = it }
        }
    }

    private fun build(context: Context): OuiDatabase {
        ensureKeystoreKey()
        val passphrase = retrieveOrCreatePassphrase(context)

        val factory = SupportFactory(passphrase, object : SQLiteDatabaseHook {
            override fun preKey(database: net.sqlcipher.database.SQLiteDatabase) {}
            override fun postKey(database: net.sqlcipher.database.SQLiteDatabase) {
                // Enable WAL for improved concurrent write throughput
                database.execSQL("PRAGMA journal_mode=WAL;")
            }
        })
        // Zero passphrase from working memory — SupportFactory made its own copy
        passphrase.fill(0)

        return Room.databaseBuilder(context, OuiDatabase::class.java, DB_NAME)
            .openHelperFactory(factory)
            .fallbackToDestructiveMigration()
            .build()
    }

    // ── Passphrase management ─────────────────────────────────────────────

    /**
     * Returns the 32-byte database passphrase, decrypting it from SharedPreferences
     * if it already exists, or generating a new one and storing it encrypted.
     *
     * The returned [ByteArray] MUST be zeroed by the caller after use.
     */
    private fun retrieveOrCreatePassphrase(context: Context): ByteArray {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val encBase64 = prefs.getString(PREF_PASSPHRASE, null)
        val ivBase64  = prefs.getString(PREF_IV, null)

        if (encBase64 != null && ivBase64 != null) {
            return decryptPassphrase(encBase64, ivBase64)
        }

        // First run — generate random passphrase and persist it encrypted
        val passphrase = ByteArray(PASSPHRASE_BYTES).also { SecureRandom().nextBytes(it) }
        val (encryptedB64, ivB64) = encryptPassphrase(passphrase)
        prefs.edit()
            .putString(PREF_PASSPHRASE, encryptedB64)
            .putString(PREF_IV, ivB64)
            .apply()
        return passphrase
    }

    /**
     * Encrypts [passphrase] using the Keystore-backed AES-GCM key.
     * Returns a pair of (Base64-encoded ciphertext, Base64-encoded IV).
     */
    private fun encryptPassphrase(passphrase: ByteArray): Pair<String, String> {
        val cipher = Cipher.getInstance(AES_GCM_ALGO)
        cipher.init(Cipher.ENCRYPT_MODE, getKeystoreKey())
        val ciphertext = cipher.doFinal(passphrase)
        return Pair(
            Base64.encodeToString(ciphertext, Base64.DEFAULT),
            Base64.encodeToString(cipher.iv, Base64.DEFAULT),
        )
    }

    /**
     * Decrypts the stored passphrase using the Keystore-backed AES-GCM key.
     * The returned [ByteArray] MUST be zeroed by the caller after use.
     */
    private fun decryptPassphrase(encBase64: String, ivBase64: String): ByteArray {
        val iv         = Base64.decode(ivBase64, Base64.DEFAULT)
        val ciphertext = Base64.decode(encBase64, Base64.DEFAULT)
        val cipher     = Cipher.getInstance(AES_GCM_ALGO)
        cipher.init(Cipher.DECRYPT_MODE, getKeystoreKey(), GCMParameterSpec(GCM_TAG_LEN, iv))
        return cipher.doFinal(ciphertext)
    }

    // ── Android Keystore helpers ──────────────────────────────────────────

    /**
     * Retrieves the AES-GCM wrapping key from the Android Keystore,
     * or generates it if it does not exist yet.
     */
    private fun getKeystoreKey(): java.security.Key {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            generateKeyInKeystore()
        }
        return keyStore.getKey(KEY_ALIAS, null)
    }

    /**
     * Generates an AES-256-GCM wrapping key in the Android Keystore.
     *
     * Requests hardware-backed (StrongBox) storage where available.  If the
     * device does not have a StrongBox security element, falls back to TEE
     * storage — both are secure for this use case.
     */
    private fun generateKeyInKeystore() {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            KEYSTORE_PROVIDER,
        )
        val spec = tryBuildStrongBoxSpec() ?: buildTeeSpec()
        keyGenerator.init(spec)
        keyGenerator.generateKey()
    }

    /**
     * Attempts to build a [KeyGenParameterSpec] that requests hardware-backed
     * (StrongBox) key storage.  Returns `null` when StrongBox is unavailable.
     */
    private fun tryBuildStrongBoxSpec(): KeyGenParameterSpec? = try {
        KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setIsStrongBoxBacked(true)
            .build()
    } catch (_: Exception) {
        // StrongBox not available on this device
        null
    }

    /** Builds a TEE-backed (non-StrongBox) [KeyGenParameterSpec]. */
    private fun buildTeeSpec(): KeyGenParameterSpec =
        KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()

    /** Ensures the Keystore wrapping key exists (idempotent). */
    private fun ensureKeystoreKey() {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            generateKeyInKeystore()
        }
    }
}

// ── Convenience extension ─────────────────────────────────────────────────────

/**
 * Look up the manufacturer for a colon-separated [bssid] using the encrypted
 * [OuiDatabase].  Returns an empty string when the OUI is not found or [bssid]
 * is malformed.
 *
 * Must NOT be called on the main thread.
 */
suspend fun OuiDatabase.lookupManufacturer(bssid: String): String =
    withContext(Dispatchers.IO) {
        val key = bssidToOuiKey(bssid) ?: return@withContext ""
        ouiDao().lookupManufacturer(key) ?: ""
    }

/**
 * Converts a colon-separated BSSID (e.g. `"AC:D7:5B:A1:8F:96"`) to the
 * 6-character upper-case hex OUI key used in the database (e.g. `"ACD75B"`).
 * Returns `null` when [bssid] is malformed.
 */
private fun bssidToOuiKey(bssid: String): String? {
    val parts = bssid.split(":")
    if (parts.size < 3) return null
    val hexOctet = Regex("^[0-9A-Fa-f]{2}$")
    if (parts.take(3).any { !it.matches(hexOctet) }) return null
    return "${parts[0]}${parts[1]}${parts[2]}".uppercase()
}
