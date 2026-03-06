package com.wifisentry.core

import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

/**
 * Calls the Google Gemini REST API for AI-powered threat analysis.
 *
 * Upgraded to [DEFAULT_MODEL] (gemini-2.0-flash) and OkHttp for connection pooling,
 * automatic retries, and better timeout handling vs raw HttpURLConnection.
 *
 * All public methods are suspend functions and execute on [Dispatchers.IO].
 */
object GeminiAnalyzer {

    private const val BASE_URL    = "https://generativelanguage.googleapis.com/v1beta"
    const val DEFAULT_MODEL       = "gemini-2.0-flash"
    const val MAX_RESPONSE_CHARS  = 1_200
    private const val MAX_LOGS    = 100

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val dateFormat: DateTimeFormatter =
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.of("UTC"))

    private const val SYSTEM_PROMPT = """
        You are a cybersecurity expert specialising in 802.11 wireless networks.
        Analyse the following Wi-Fi data and provide a concise, actionable assessment:
        1. Severity level (Critical / High / Medium / Low)
        2. Technical explanation of the detected issues
        3. Recommended mitigation actions
        Keep your response brief and factual.
    """

    // ── Public API ────────────────────────────────────────────────────────

    /** Generic Gemini call with a custom prompt. */
    suspend fun analyze(apiKey: String, prompt: String): GeminiResult =
        withContext(Dispatchers.IO) {
            runCatching { callApi(apiKey, "$SYSTEM_PROMPT\n\n$prompt") }
                .getOrElse { e -> GeminiResult(error = "Network error: ${e.javaClass.simpleName}") }
        }

    /** Analyse a batch of [ScannedNetwork] results from a single scan. */
    suspend fun analyzeScanResults(apiKey: String, networks: List<ScannedNetwork>): GeminiResult {
        if (networks.isEmpty()) return GeminiResult(text = "No networks to analyse.")
        val prompt = buildString {
            appendLine("Analyse these Wi-Fi networks:")
            networks.take(15).forEach { n ->
                val sec = WifiDisplayUtils.capabilitiesToSecurityLabel(n.capabilities)
                appendLine("- SSID: '${n.ssid}', BSSID: ${n.bssid}, " +
                    "RSSI: ${n.rssi} dBm, Security: $sec, " +
                    "Threats: ${n.threats.joinToString { it.name }}")
            }
        }
        return analyze(apiKey, prompt)
    }

    /**
     * Analyse a list of [FrameThreatEvent]s detected during a monitoring session.
     * Generates a CSV summary and requests a natural-language threat assessment.
     */
    suspend fun analyzeFrameThreats(apiKey: String, events: List<FrameThreatEvent>): GeminiResult {
        if (events.isEmpty()) return GeminiResult(text = "No frame-level threats to analyse.")
        val csv = buildString {
            appendLine("timestamp,threat_type,bssid,ssid,description")
            events.takeLast(MAX_LOGS).forEach { e ->
                val ts = dateFormat.format(Instant.ofEpochMilli(e.timestampMs))
                appendLine("$ts,${e.threatType.name},${e.bssid},${e.ssid}," +
                    "\"${e.description.replace("\"", "\"\"")}\"")
            }
        }
        val prompt = "Analyse the following Wi-Fi frame-level threat log (CSV):\n$csv"
        return analyze(apiKey, prompt)
    }

    // ── Private ───────────────────────────────────────────────────────────

    private fun callApi(apiKey: String, prompt: String): GeminiResult {
        val body = gson.toJson(GeminiRequest(listOf(GeminiContent(listOf(GeminiPart(prompt))))))
            .toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url("$BASE_URL/models/$DEFAULT_MODEL:generateContent?key=$apiKey")
            .post(body)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                return GeminiResult(error = "API returned HTTP ${response.code}")
            }
            val json = response.body?.string()
                ?: return GeminiResult(error = "Empty body from API")
            val parsed = gson.fromJson(json, GeminiResponse::class.java)
            val text = parsed.candidates?.firstOrNull()?.content?.parts?.firstOrNull()?.text
                ?.take(MAX_RESPONSE_CHARS)
            return if (text.isNullOrBlank()) GeminiResult(error = "Empty response from AI")
            else GeminiResult(text = text)
        }
    }

    // ── DTOs ──────────────────────────────────────────────────────────────

    private data class GeminiRequest(val contents: List<GeminiContent>)
    private data class GeminiContent(val parts: List<GeminiPart>)
    private data class GeminiPart(val text: String)
    private data class GeminiResponse(val candidates: List<GeminiCandidate>?)
    private data class GeminiCandidate(val content: GeminiContent?)
}

/** Result of a Gemini API call. Exactly one of [text] or [error] is non-null. */
data class GeminiResult(
    val text: String? = null,
    val error: String? = null,
)
