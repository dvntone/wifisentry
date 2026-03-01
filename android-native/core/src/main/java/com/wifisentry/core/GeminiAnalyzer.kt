package com.wifisentry.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Calls the Google Gemini REST API to provide AI-powered threat analysis.
 *
 * ## Security model — read before modifying
 *
 * The API key is **never** stored in this class.  It is accepted as a function
 * parameter, passed by the caller from SharedPreferences (private storage) at
 * call-time.  It is transmitted ONLY as the `x-goog-api-key` HTTP request
 * header — it is NOT embedded in the URL, NOT written to any log, and NOT
 * included in any error message surfaced to the UI.
 *
 * Do NOT change this contract:
 * - No `Log.d/e/w` of the key
 * - No key in URL query params
 * - No key in exception messages
 * - No key in exported data
 *
 * ## Gemini model
 * Uses `gemini-1.5-flash` (fast, cheap, available on the free tier).  Switch
 * to `gemini-1.5-pro` in [ENDPOINT] for deeper analysis if the user has a
 * paid quota.
 */
object GeminiAnalyzer {

    private const val ENDPOINT =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    /** Maximum response characters to show in the UI. */
    const val MAX_RESPONSE_CHARS = 1200

    /**
     * Synchronous Gemini call — **must** be invoked on a background thread /
     * inside a coroutine with [Dispatchers.IO].
     *
     * @param apiKey   The user's Gemini API key, passed from private SharedPreferences.
     *                 Never logs or stores this value.
     * @param prompt   The analysis prompt. The caller is responsible for building
     *                 it from local data — no raw network data should be sent that
     *                 could identify the user (e.g. GPS coordinates).
     * @return [GeminiResult] with either [GeminiResult.text] or [GeminiResult.error].
     */
    suspend fun analyze(apiKey: String, prompt: String): GeminiResult =
        withContext(Dispatchers.IO) {
            runCatching { callApi(apiKey, prompt) }
                .getOrElse { e ->
                    // Include only generic error class — never include the API key in messages.
                    GeminiResult(error = "Network error: ${e.javaClass.simpleName}")
                }
        }

    /**
     * Specialized batch analysis for a list of scanned networks.
     */
    suspend fun analyzeScanResults(apiKey: String, networks: List<ScannedNetwork>): GeminiResult {
        if (networks.isEmpty()) return GeminiResult(text = "No networks to analyze.")
        
        val prompt = buildString {
            appendLine("Analyze the following Wi-Fi networks for potential spoofing, evil twin, or rogue-AP attacks:")
            networks.take(15).forEach { n ->
                val sec = WifiDisplayUtils.capabilitiesToSecurityLabel(n.capabilities)
                appendLine("- SSID: '${n.ssid}', BSSID: ${n.bssid}, RSSI: ${n.rssi}dBm, Security: $sec, Threats: ${n.threats.joinToString { it.name }}")
            }
            appendLine("\nProvide a high-level summary of the overall threat environment and highlight any critical risks.")
        }
        
        return analyze(apiKey, prompt)
    }

    // ── private ────────────────────────────────────────────────────────────

    private fun callApi(apiKey: String, prompt: String): GeminiResult {
        val connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod        = "POST"
            doOutput             = true
            connectTimeout       = 15_000
            readTimeout          = 30_000
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            // Key transmitted as a request header only — never in the URL.
            setRequestProperty("x-goog-api-key", apiKey)
        }

        val body = buildRequestJson(prompt)
        OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { it.write(body) }

        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val response = BufferedReader(InputStreamReader(stream, Charsets.UTF_8))
            .use { it.readText() }
        connection.disconnect()

        if (code !in 200..299) {
            // Surface HTTP error code but NOT the full response (may echo back the key in some errors).
            return GeminiResult(error = "API returned HTTP $code")
        }

        return parseResponse(response)
    }

    /**
     * Build a minimal Gemini `generateContent` request JSON.
     * No user-identifying data beyond the provided [prompt] is included.
     */
    private fun buildRequestJson(prompt: String): String {
        // Escape special characters manually to avoid requiring a JSON library here.
        val escaped = prompt
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
        return """{"contents":[{"parts":[{"text":"$escaped"}]}],"generationConfig":{"maxOutputTokens":400}}"""
    }

    /**
     * Extract the first `text` part from the Gemini response JSON.
     * Uses simple string scanning to avoid a JSON dependency in the core module.
     */
    private fun parseResponse(json: String): GeminiResult {
        // Look for: "text": "<content>"
        val textKey = "\"text\":"
        val idx = json.indexOf(textKey)
        if (idx < 0) return GeminiResult(error = "No text content in response")

        // Find the opening quote of the value
        val valueStart = json.indexOf('"', idx + textKey.length)
        if (valueStart < 0) return GeminiResult(error = "Malformed response")

        // Scan for the closing quote, honoring escape sequences
        val sb = StringBuilder()
        var i = valueStart + 1
        while (i < json.length) {
            val ch = json[i]
            if (ch == '\\' && i + 1 < json.length) {
                when (json[i + 1]) {
                    'n'  -> { sb.append('\n'); i += 2; continue }
                    'r'  -> { sb.append('\r'); i += 2; continue }
                    't'  -> { sb.append('\t'); i += 2; continue }
                    '"'  -> { sb.append('"');  i += 2; continue }
                    '\\' -> { sb.append('\\'); i += 2; continue }
                    else -> { sb.append(json[i + 1]); i += 2; continue }
                }
            }
            if (ch == '"') break
            sb.append(ch)
            i++
        }
        val text = sb.toString().take(MAX_RESPONSE_CHARS)
        return if (text.isBlank()) GeminiResult(error = "Empty response from AI")
        else GeminiResult(text = text)
    }
}

/**
 * Result of a Gemini API call.  Exactly one of [text] or [error] is non-null.
 */
data class GeminiResult(
    val text: String? = null,
    val error: String? = null,
)
