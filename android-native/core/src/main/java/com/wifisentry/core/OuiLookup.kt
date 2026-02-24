package com.wifisentry.core

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.Properties

/**
 * Looks up the IEEE-registered manufacturer name for a BSSID's OUI prefix.
 *
 * The lookup table is loaded lazily from one of two sources (in priority order):
 * 1. A locally-cached file written by [updateFromGitHub] on a previous run.
 * 2. The bundled `oui.properties` asset shipped with the APK.
 *
 * File format is identical to WiGLE's bundled OUI database — standard Java
 * [Properties] format where each key is a 6-character upper-case hex string
 * (first 3 BSSID octets without separators) and the value is the manufacturer
 * name:
 * ```
 * ACD75B=T-Mobile
 * E4BFFA=Technicolor
 * ```
 *
 * The GitHub update URL points to the `oui.properties` file hosted in the
 * Wi-Fi Sentry repository so the app can pull a refreshed database without
 * requiring an app-store update.  The in-repo file uses the same WiGLE-
 * compatible format and can be replaced with a full IEEE MA-L dump at any time.
 */
object OuiLookup {

    private const val ASSET_FILENAME  = "oui.properties"
    private const val CACHE_FILENAME  = "oui_cache.properties"
    private const val GITHUB_URL =
        "https://raw.githubusercontent.com/dvntone/wifisentry/main/android-native/oui.properties"
    /**
     * Minimum number of `=`-separated lines required to accept a downloaded file
     * as a valid OUI database.  A real IEEE OUI dump has thousands of entries;
     * requiring at least 10 guards against accepting an error-page response.
     */
    private const val MIN_VALID_OUI_ENTRIES = 10

    @Volatile
    private var properties: Properties? = null

    /**
     * Return the manufacturer name for [bssid], or an empty string when
     * the OUI is not found or [bssid] is malformed.
     *
     * The properties table is loaded on first call; subsequent calls are O(1).
     */
    fun lookup(context: Context, bssid: String): String {
        val key = bssidToKey(bssid) ?: return ""
        return getProperties(context).getProperty(key, "")
    }

    /**
     * Download a refreshed OUI database from GitHub and cache it locally.
     * Silently ignores network failures so the app remains functional offline.
     *
     * Call from a background coroutine; switches to [Dispatchers.IO] internally.
     */
    suspend fun updateFromGitHub(context: Context) = withContext(Dispatchers.IO) {
        try {
            val conn = URL(GITHUB_URL).openConnection() as HttpURLConnection
            conn.connectTimeout = 10_000
            conn.readTimeout    = 15_000
            conn.setRequestProperty("User-Agent", "WifiSentry-OUI-Updater")
            if (conn.responseCode != HttpURLConnection.HTTP_OK) return@withContext

            val text = conn.inputStream.bufferedReader(StandardCharsets.UTF_8).readText()
            conn.disconnect()

            // Validate: must contain at least a few property entries
            if (text.lines().count { it.contains('=') } < MIN_VALID_OUI_ENTRIES) return@withContext

            val cacheFile = File(context.filesDir, CACHE_FILENAME)
            cacheFile.writeText(text)
            // Invalidate cached table so next lookup re-parses from the new file
            properties = null
        } catch (_: Exception) {
            // Network unavailable or server error — keep existing table
        }
    }

    // ── internal helpers ──────────────────────────────────────────────────

    private fun getProperties(context: Context): Properties {
        properties?.let { return it }
        val loaded = loadProperties(context)
        properties = loaded
        return loaded
    }

    private fun loadProperties(context: Context): Properties {
        val props = Properties()
        // Prefer a locally-cached download over the bundled asset
        val cacheFile = File(context.filesDir, CACHE_FILENAME)
        if (cacheFile.exists() && cacheFile.length() > 0) {
            try {
                cacheFile.reader(StandardCharsets.UTF_8).use { props.load(it) }
                return props
            } catch (_: Exception) { /* fall through to bundled asset */ }
        }
        try {
            InputStreamReader(context.assets.open(ASSET_FILENAME), StandardCharsets.UTF_8)
                .use { props.load(it) }
        } catch (_: Exception) { /* asset missing — return empty */ }
        return props
    }

    /**
     * Converts a colon-separated BSSID like `AC:D7:5B:A1:8F:96` to the
     * 6-character upper-case hex key used in the properties file (`ACD75B`),
     * or null if [bssid] is malformed.
     */
    private fun bssidToKey(bssid: String): String? {
        val parts = bssid.split(":")
        if (parts.size < 3) return null
        val hexOctet = Regex("^[0-9A-Fa-f]{2}$")
        if (parts.take(3).any { !it.matches(hexOctet) }) return null
        return "${parts[0]}${parts[1]}${parts[2]}".uppercase()
    }
}

