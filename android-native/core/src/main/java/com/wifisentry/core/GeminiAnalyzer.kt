package com.wifisentry.core

import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Calls the Google Gemini REST API to provide AI-powered threat analysis.
 * Standardized to provide severity, explanation, and mitigation strategies.
 */
object GeminiAnalyzer {

    private const val ENDPOINT =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    private val gson = Gson()

    /** Maximum response characters to show in the UI. */
    const val MAX_RESPONSE_CHARS = 1200

    /**
     * Standardized prompt prefix to ensure consistent 'Cybersecurity Expert' persona
     * across both Android and Backend.
     */
    private const val SYSTEM_PROMPT = """
        As a cybersecurity WiFi expert, analyze the following WiFi scan data for potential threats.
        Provide a concise, professional summary including:
        1. Severity level (Critical, High, Medium, Low)
        2. Technical explanation
        3. Mitigation strategies
        
        Keep your response brief and actionable.
    """

    /**
     * Synchronous Gemini call — **must** be invoked on a background thread /
     * inside a coroutine with [Dispatchers.IO].
     */
    suspend fun analyze(apiKey: String, prompt: String): GeminiResult =
        withContext(Dispatchers.IO) {
            runCatching { callApi(apiKey, "$SYSTEM_PROMPT\n\n$prompt") }
                .getOrElse { e ->
                    GeminiResult(error = "Network error: ${e.javaClass.simpleName}")
                }
        }

    /**
     * Specialized batch analysis for a list of scanned networks.
     */
    suspend fun analyzeScanResults(apiKey: String, networks: List<ScannedNetwork>): GeminiResult {
        if (networks.isEmpty()) return GeminiResult(text = "No networks to analyze.")
        
        val prompt = buildString {
            appendLine("Analyze these networks:")
            networks.take(15).forEach { n ->
                val sec = WifiDisplayUtils.capabilitiesToSecurityLabel(n.capabilities)
                appendLine("- SSID: '${n.ssid}', BSSID: ${n.bssid}, RSSI: ${n.rssi}dBm, Security: $sec, Threats: ${n.threats.joinToString { it.name }}")
            }
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
            setRequestProperty("x-goog-api-key", apiKey)
        }

        val request = GeminiRequest(listOf(GeminiContent(listOf(GeminiPart(prompt)))))
        OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { 
            it.write(gson.toJson(request))
        }

        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val responseJson = InputStreamReader(stream, Charsets.UTF_8).use { it.readText() }
        connection.disconnect()

        if (code !in 200..299) {
            return GeminiResult(error = "API returned HTTP $code")
        }

        val response = gson.fromJson(responseJson, GeminiResponse::class.java)
        val text = response.candidates?.firstOrNull()?.content?.parts?.firstOrNull()?.text
            ?.take(MAX_RESPONSE_CHARS)
        
        return if (text.isNullOrBlank()) GeminiResult(error = "Empty response from AI")
        else GeminiResult(text = text)
    }

    // ── DTOs for Gson ──────────────────────────────────────────────────────

    private data class GeminiRequest(val contents: List<GeminiContent>)
    private data class GeminiContent(val parts: List<GeminiPart>)
    private data class GeminiPart(val text: String)

    private data class GeminiResponse(val candidates: List<GeminiCandidate>?)
    private data class GeminiCandidate(val content: GeminiContent?)
}

/**
 * Result of a Gemini API call.  Exactly one of [text] or [error] is non-null.
 */
data class GeminiResult(
    val text: String? = null,
    val error: String? = null,
)

