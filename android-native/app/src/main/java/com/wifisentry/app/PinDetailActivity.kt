package com.wifisentry.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Typeface
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.wifisentry.app.databinding.ActivityPinDetailBinding
import com.wifisentry.core.ChangeAnalyzer
import com.wifisentry.core.ChangeType
import com.wifisentry.core.GeminiAnalyzer
import com.wifisentry.core.OuiLookup
import com.wifisentry.core.PinnedStorage
import com.wifisentry.core.ScanStorage
import com.wifisentry.core.ThreatSeverity
import com.wifisentry.core.WifiDisplayUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Dedicated tracking page for a single pinned AP.
 *
 * Shows:
 * 1. AP identity (SSID, BSSID, manufacturer, pinned date)
 * 2. Gemini AI threat analysis (optional — requires user-supplied API key)
 * 3. AP change analysis via [ChangeAnalyzer] scoped to this specific BSSID
 * 4. Full per-BSSID scan history chronologically
 *
 * Launched from [MainActivity.showNetworkActionSheet] or from a future
 * Pinned Networks screen.
 */
class PinDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPinDetailBinding

    /** BSSID of the network being tracked — passed via [EXTRA_BSSID]. */
    private lateinit var bssid: String
    /** SSID at time of pinning — passed via [EXTRA_SSID]. */
    private lateinit var ssid: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPinDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.updatePadding(
                left   = systemBars.left,
                top    = systemBars.top,
                right  = systemBars.right,
                bottom = systemBars.bottom
            )
            insets
        }
        
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        bssid = intent.getStringExtra(EXTRA_BSSID) ?: run { finish(); return }
        ssid  = intent.getStringExtra(EXTRA_SSID)  ?: ""

        title = getString(R.string.title_pin_detail)

        binding.textPinSsid.text  = ssid.ifBlank { getString(R.string.hidden_ssid) }
        binding.textPinBssid.text = getString(R.string.detail_label_bssid, bssid)

        // Pinned-since label
        val pin = PinnedStorage(applicationContext).loadPinned().firstOrNull { it.bssid == bssid }
        if (pin != null) {
            val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
            binding.textPinSince.text = getString(R.string.pin_since, fmt.format(Date(pin.pinnedAtMs)))
        }

        // Manufacturer lookup
        lifecycleScope.launch(Dispatchers.IO) {
            val mfgr = OuiLookup.lookup(applicationContext, bssid)
            if (mfgr.isNotBlank()) {
                withContext(Dispatchers.Main) {
                    binding.textPinMfgr.text       = getString(R.string.detail_label_manufacturer, mfgr)
                    binding.textPinMfgr.visibility = View.VISIBLE
                }
            }
        }

        // ── Quick action buttons ───────────────────────────────────────────
        binding.buttonCopySsid.setOnClickListener  { copyToClipboard(ssid,  R.string.copied_ssid)  }
        binding.buttonCopyBssid.setOnClickListener { copyToClipboard(bssid, R.string.copied_bssid) }
        binding.buttonUnpin.setOnClickListener     { unpinAndFinish()                               }

        // ── Gemini AI button ───────────────────────────────────────────────
        binding.buttonAskGemini.setOnClickListener { onAskGemini() }

        // ── Load history + changes in background ──────────────────────────
        loadHistoryAndChanges()
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }

    // ── Gemini AI ──────────────────────────────────────────────────────────

    /**
     * Retrieves the Gemini API key from private SharedPreferences.
     * If no key is stored, shows an input dialog to let the user enter it.
     * The key is stored ONLY in the app's private SharedPreferences file —
     * it is never logged, never transmitted in a URL, and never exported.
     */
    private fun onAskGemini() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val storedKey = prefs.getString(PREF_GEMINI_KEY, null)
        if (storedKey.isNullOrBlank()) {
            showApiKeyDialog { key ->
                prefs.edit().putString(PREF_GEMINI_KEY, key).apply()
                runGeminiAnalysis(key)
            }
        } else {
            runGeminiAnalysis(storedKey)
        }
    }

    /**
     * Shows a dialog asking for the Gemini API key.
     * The input field uses [TextInputLayout] with password masking so the key is
     * not visible on screen by default.  The key is only used after the user
     * explicitly taps "Analyze" — it is never pre-filled from code.
     */
    private fun showApiKeyDialog(onKey: (String) -> Unit) {
        val ctx = this
        val inputLayout = TextInputLayout(ctx).apply {
            hint = getString(R.string.gemini_key_hint)
            endIconMode = TextInputLayout.END_ICON_PASSWORD_TOGGLE
            val dp16 = (16 * resources.displayMetrics.density).toInt()
            setPadding(dp16, dp16, dp16, 0)
        }
        val editText = TextInputEditText(inputLayout.context).apply {
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                        android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        inputLayout.addView(editText)

        MaterialAlertDialogBuilder(ctx)
            .setTitle(R.string.gemini_key_dialog_title)
            .setMessage(R.string.gemini_key_dialog_message)
            .setView(inputLayout)
            .setPositiveButton(R.string.gemini_key_save) { _, _ ->
                val key = editText.text?.toString()?.trim() ?: ""
                if (key.isNotBlank()) onKey(key)
                else Snackbar.make(binding.root, R.string.gemini_key_empty, Snackbar.LENGTH_SHORT).show()
            }
            .setNegativeButton(android.R.string.cancel, null)
            .setNeutralButton(R.string.gemini_key_clear) { _, _ ->
                getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit().remove(PREF_GEMINI_KEY).apply()
                Snackbar.make(binding.root, R.string.gemini_key_cleared, Snackbar.LENGTH_SHORT).show()
            }
            .show()
    }

    /**
     * Calls [GeminiAnalyzer] with a structured prompt built from local scan data.
     * The API key is passed as a parameter only — it is not stored in any field,
     * not logged, and not included in any error message shown to the user.
     */
    private fun runGeminiAnalysis(apiKey: String) {
        binding.buttonAskGemini.isEnabled    = false
        binding.progressGemini.visibility    = View.VISIBLE
        binding.textGeminiResult.text        = getString(R.string.gemini_thinking)

        lifecycleScope.launch {
            // Build the analysis context from local data only.
            // No GPS coordinates are sent — only SSID, BSSID, security type, signal info,
            // and the detected threats / changes from local analysis.
            val prompt = buildGeminiPrompt()

            // Call the API on IO — key is passed as parameter, never stored in a field.
            val result = GeminiAnalyzer.analyze(apiKey, prompt)

            withContext(Dispatchers.Main) {
                binding.progressGemini.visibility = View.GONE
                binding.buttonAskGemini.isEnabled = true
                if (result.text != null) {
                    binding.textGeminiResult.text = result.text
                    binding.textGeminiResult.setTextColor(
                        getColor(android.R.color.tab_indicator_text))
                } else {
                    binding.textGeminiResult.text =
                        getString(R.string.gemini_error, result.error ?: "unknown error")
                    binding.textGeminiResult.setTextColor(getColor(R.color.status_error))
                }
            }
        }
    }

    /**
     * Builds a Gemini prompt from locally-computed data.
     * Does NOT include GPS coordinates or other user-identifying information.
     */
    private suspend fun buildGeminiPrompt(): String = withContext(Dispatchers.IO) {
        val storage = ScanStorage(applicationContext)
        val allRecords = storage.loadHistory()
        val appearances = allRecords
            .filter { rec -> rec.networks.any { it.bssid == bssid } }
            .flatMap { rec -> rec.networks.filter { it.bssid == bssid } }

        val latestNet = appearances.firstOrNull()
        val secLabel  = latestNet?.let {
            WifiDisplayUtils.capabilitiesToSecurityLabel(it.capabilities)
        } ?: "unknown"
        val band      = latestNet?.let { WifiDisplayUtils.frequencyToBand(it.frequency) } ?: "unknown"
        val ch        = latestNet?.let { WifiDisplayUtils.frequencyToChannel(it.frequency) } ?: -1
        val rssiRange = if (appearances.isNotEmpty()) {
            "${appearances.minOf { it.rssi }} to ${appearances.maxOf { it.rssi }} dBm"
        } else "unknown"
        val threats   = appearances.flatMap { it.threats }.toSet()
        val mfgr      = OuiLookup.lookup(applicationContext, bssid)

        val changeResult = ChangeAnalyzer.analyze(allRecords)
        val relevantChanges = changeResult.changes.filter { it.bssid == bssid }

        buildString {
            appendLine("Analyze this Wi-Fi access point for potential security threats.")
            appendLine("SSID: '${ssid.ifBlank { "(hidden)" }}'")
            appendLine("BSSID: $bssid")
            if (mfgr.isNotBlank()) appendLine("Manufacturer: $mfgr")
            appendLine("Security: $secLabel")
            if (ch > 0) appendLine("Band / Channel: $band ch$ch")
            appendLine("Observed signal range: $rssiRange")
            appendLine("Seen in ${appearances.size} scan record(s).")
            if (threats.isNotEmpty()) {
                appendLine("Locally-detected threats: ${threats.joinToString { it.name }}")
            }
            if (relevantChanges.isNotEmpty()) {
                appendLine("Detected AP changes:")
                relevantChanges.take(5).forEach { c ->
                    appendLine("  • ${c.type.name}: ${c.description.take(200)}")
                }
            }
            appendLine()
            appendLine("Based only on the above information: (1) Is this network a genuine " +
                    "security threat? (2) What is the most likely explanation? " +
                    "(3) What should the user do? Be concise (3–5 sentences).")
        }
    }

    // ── History & changes ──────────────────────────────────────────────────

    private fun loadHistoryAndChanges() {
        lifecycleScope.launch(Dispatchers.IO) {
            val storage    = ScanStorage(applicationContext)
            val allRecords = storage.loadHistory()

            // Filter to scan records that contain this BSSID
            val appearances = allRecords
                .filter { rec -> rec.networks.any { it.bssid == bssid } }
                .sortedByDescending { it.timestampMs }

            // ChangeAnalyzer results scoped to this BSSID
            val changeResult     = ChangeAnalyzer.analyze(allRecords)
            val relevantChanges  = changeResult.changes.filter { it.bssid == bssid }

            withContext(Dispatchers.Main) {
                // ── Change analysis section ─────────────────────────────
                if (relevantChanges.isEmpty()) {
                    binding.textPinChanges.text = getString(R.string.pin_no_changes)
                } else {
                    val sb = StringBuilder()
                    relevantChanges.take(10).forEach { c ->
                        val icon = when (c.severity) {
                            ThreatSeverity.HIGH   -> "🔴"
                            ThreatSeverity.MEDIUM -> "🟠"
                            ThreatSeverity.LOW    -> "🟡"
                        }
                        val label = c.type.name.lowercase().replace('_', ' ')
                        sb.appendLine("$icon $label (${c.score}/100)")
                        sb.appendLine("  Prev: ${c.previousValue}")
                        sb.appendLine("  Now:  ${c.currentValue}")
                        sb.appendLine()
                    }
                    binding.textPinChanges.text = sb.toString().trimEnd()
                }

                // ── History section ─────────────────────────────────────
                val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                binding.textHistoryTitle.text =
                    getString(R.string.pin_history_title_count, appearances.size)

                if (appearances.isEmpty()) {
                    addHistoryRow(binding.layoutHistoryRows, getString(R.string.pin_no_history))
                } else {
                    appearances.take(50).forEach { rec ->
                        val net = rec.networks.first { it.bssid == bssid }
                        val sec = WifiDisplayUtils.capabilitiesToSecurityLabel(net.capabilities)
                        val ch  = WifiDisplayUtils.frequencyToChannel(net.frequency)
                        val band = WifiDisplayUtils.frequencyToBand(net.frequency)
                        val flagTag = if (net.isFlagged) "  ⚠ ${net.threats.size} threat(s)" else ""
                        val row = buildString {
                            append(fmt.format(Date(rec.timestampMs)))
                            append("  ·  ${net.rssi} dBm  ·  $sec  ·  $band ch$ch$flagTag")
                        }
                        addHistoryRow(binding.layoutHistoryRows, row, net.isFlagged)
                    }
                }
            }
        }
    }

    private fun addHistoryRow(container: LinearLayout, text: String, flagged: Boolean = false) {
        val scale = resources.displayMetrics.density
        val tv = TextView(this).apply {
            this.text = text
            textSize  = 12f
            setPadding(0, (4 * scale + 0.5f).toInt(), 0, (4 * scale + 0.5f).toInt())
            if (flagged) {
                setTextColor(getColor(R.color.status_error))
                setTypeface(null, Typeface.BOLD)
            }
        }
        container.addView(tv)
    }

    // ── Utilities ──────────────────────────────────────────────────────────

    private fun copyToClipboard(text: String, toastResId: Int) {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("wifisentry", text))
        Snackbar.make(binding.root, toastResId, Snackbar.LENGTH_SHORT).show()
    }

    private fun unpinAndFinish() {
        PinnedStorage(applicationContext).unpin(bssid)
        Snackbar.make(binding.root, getString(R.string.pin_removed, ssid.ifBlank { bssid }), Snackbar.LENGTH_SHORT).show()
        finish()
    }

    companion object {
        const val EXTRA_BSSID = "extra_bssid"
        const val EXTRA_SSID  = "extra_ssid"

        /** SharedPreferences file for app settings (Gemini key etc.). */
        const val PREFS_NAME = "wifisentry_prefs"
        /** Key for the Gemini API key in [PREFS_NAME]. Never logged or exported. */
        const val PREF_GEMINI_KEY = "gemini_api_key"
    }
}
