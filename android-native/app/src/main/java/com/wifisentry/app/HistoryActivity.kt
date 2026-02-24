package com.wifisentry.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.wifisentry.app.databinding.ActivityHistoryBinding
import com.wifisentry.core.ScanRecord
import com.wifisentry.core.ScanStorage
import com.wifisentry.core.ScannedNetwork
import com.wifisentry.core.WifiDisplayUtils
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class HistoryActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHistoryBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHistoryBinding.inflate(layoutInflater)
        setContentView(binding.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        val storage = ScanStorage(applicationContext)
        val history = storage.loadHistory()

        if (history.isEmpty()) {
            binding.textEmpty.visibility    = View.VISIBLE
            binding.recyclerHistory.visibility = View.GONE
            binding.buttonExport.isEnabled  = false
            binding.buttonImport.isEnabled  = true
            binding.buttonImport.setOnClickListener {
                startActivity(Intent(this, ImportActivity::class.java))
            }
            return
        }

        binding.textEmpty.visibility    = View.GONE
        binding.recyclerHistory.visibility = View.VISIBLE
        binding.recyclerHistory.layoutManager = LinearLayoutManager(this)
        binding.recyclerHistory.adapter   = HistoryAdapter(history)

        binding.buttonImport.isEnabled = true
        binding.buttonImport.setOnClickListener {
            startActivity(Intent(this, ImportActivity::class.java))
        }
        binding.buttonExport.setOnClickListener { showExportDialog(history) }
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }

    // ── Export ─────────────────────────────────────────────────────────────

    private fun showExportDialog(history: List<ScanRecord>) {
        val formats = arrayOf(
            getString(R.string.export_format_csv),
            getString(R.string.export_format_text),
            getString(R.string.export_format_wigle),
            getString(R.string.export_format_m8b),
        )
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.export_dialog_title)
            .setItems(formats) { _, which ->
                when (which) {
                    0 -> shareExport(history, ExportFormat.CSV)
                    1 -> shareExport(history, ExportFormat.TEXT)
                    2 -> shareExport(history, ExportFormat.WIGLE)
                    3 -> shareExport(history, ExportFormat.M8B)
                }
            }
            .setNegativeButton(R.string.dialog_close, null)
            .show()
    }

    private enum class ExportFormat { CSV, TEXT, WIGLE, M8B }

    private fun shareExport(history: List<ScanRecord>, format: ExportFormat) {
        data class Spec(val content: String, val fileName: String, val mime: String, val hint: String?)
        val spec = when (format) {
            ExportFormat.CSV   -> Spec(buildCsv(history),   "wifisentry_scan.csv",  "text/csv",   null)
            ExportFormat.TEXT  -> Spec(buildText(history),  "wifisentry_scan.txt",  "text/plain", null)
            ExportFormat.WIGLE -> Spec(buildWigle(history), "wifisentry_wigle.csv", "text/csv",   getString(R.string.export_wigle_hint))
            ExportFormat.M8B   -> Spec(buildM8b(history),   "wifisentry_m8b.tsv",   "text/tab-separated-values", getString(R.string.export_m8b_hint))
        }

        val exportDir = File(cacheDir, "exports")
        if (!exportDir.exists() && !exportDir.mkdirs()) {
            com.google.android.material.snackbar.Snackbar
                .make(binding.recyclerHistory, "Export failed: could not create export directory", com.google.android.material.snackbar.Snackbar.LENGTH_LONG)
                .show()
            return
        }
        val file = File(exportDir, spec.fileName)
        file.writeText(spec.content)

        val uri = FileProvider.getUriForFile(this, "${packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = spec.mime
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, getString(R.string.export_share_subject))
            if (spec.hint != null) putExtra(Intent.EXTRA_TEXT, spec.hint)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(intent, getString(R.string.export_chooser_title)))
    }

    // ── Export builders ────────────────────────────────────────────────────

    private fun buildCsv(history: List<ScanRecord>): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        return buildString {
            appendLine("Timestamp,SSID,BSSID,Security,RSSI,FrequencyMHz,Channel,Band,Flagged,Threats")
            for (record in history) {
                val ts = fmt.format(Date(record.timestampMs))
                for (n in record.networks) {
                    val ssid    = n.ssid.replace("\"", "\"\"")
                    val sec     = WifiDisplayUtils.capabilitiesToSecurityLabel(n.capabilities).replace("\"", "\"\"")
                    val ch      = WifiDisplayUtils.frequencyToChannel(n.frequency)
                    val band    = WifiDisplayUtils.frequencyToBand(n.frequency).replace("\"", "\"\"")
                    val threats = n.threats.joinToString(";") { it.name }
                    appendLine("\"$ts\",\"$ssid\",${n.bssid},\"$sec\",${n.rssi},${n.frequency},$ch,\"$band\",${n.isFlagged},\"$threats\"")
                }
            }
        }
    }

    private fun buildText(history: List<ScanRecord>): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        return buildString {
            appendLine("Wi-Fi Sentry — Scan History")
            appendLine("Generated: ${fmt.format(Date())}")
            appendLine("=".repeat(48))
            for (record in history) {
                appendLine()
                appendLine("Scan: ${fmt.format(Date(record.timestampMs))}")
                appendLine("  Networks: ${record.networks.size}   Flagged: ${record.networks.count { it.isFlagged }}")
                for (n in record.networks) {
                    val ssid    = n.ssid.ifBlank { "(hidden)" }
                    val sec     = WifiDisplayUtils.capabilitiesToSecurityLabel(n.capabilities)
                    val band    = WifiDisplayUtils.frequencyToBand(n.frequency)
                    val ch      = WifiDisplayUtils.frequencyToChannel(n.frequency)
                    val flagTag = if (n.isFlagged) "  ⚠ FLAGGED" else ""
                    appendLine("  • $ssid  [${n.bssid}]  ${n.rssi} dBm  $sec  $band ch$ch$flagTag")
                    if (n.isFlagged) {
                        n.threats.forEach { t ->
                            appendLine("      – ${t.name.lowercase().replace('_', ' ')}")
                        }
                    }
                }
            }
        }
    }

    /**
     * WiGLE CSV v1.4 format — compatible with manual upload at wigle.net.
     * Coordinates are 0.0 (GPS not yet available in this version).
     */
    private fun buildWigle(history: List<ScanRecord>): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        return buildString {
            appendLine("WigleWifi-1.4,appRelease=WiFiSentry,model=Android,release=0,device=WiFiSentry,display=WiFiSentry,board=Android,brand=WiFiSentry")
            appendLine("MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type")
            // Deduplicate by BSSID across all scans (unique AP counting, like Ghost_ESP wardriving)
            val seen = mutableSetOf<String>()
            for (record in history) {
                val ts = fmt.format(Date(record.timestampMs))
                for (n in record.networks) {
                    if (n.bssid.isBlank() || !seen.add(n.bssid)) continue
                    val ssid = n.ssid.replace("\"", "\"\"")
                    val auth = n.capabilities.replace("\"", "\"\"")
                    val ch   = WifiDisplayUtils.frequencyToChannel(n.frequency)
                    if (ch < 0) continue  // skip networks with unrecognised frequency
                    appendLine("${n.bssid},\"$ssid\",\"$auth\",$ts,$ch,${n.rssi},0.0,0.0,0.0,0.0,WIFI")
                }
            }
        }
    }

    /**
     * m8b input format: tab-separated MAC, latitude, longitude.
     * Used as input to wiglenet/m8b for geolocation lookups.
     * Coordinates are 0.0 — GPS support coming in a future release.
     */
    private fun buildM8b(history: List<ScanRecord>): String {
        return buildString {
            val seen = mutableSetOf<String>()
            for (record in history) {
                for (n in record.networks) {
                    if (n.bssid.isBlank() || !seen.add(n.bssid)) continue
                    appendLine("${n.bssid}\t0.0\t0.0")
                }
            }
        }
    }
}

// ── HistoryAdapter ─────────────────────────────────────────────────────────

private class HistoryAdapter(
    private val records: List<ScanRecord>
) : RecyclerView.Adapter<HistoryAdapter.HistoryViewHolder>() {

    private val dateFormat   = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
    private val expandedSet  = mutableSetOf<Int>()

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HistoryViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_history_record, parent, false)
        return HistoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: HistoryViewHolder, position: Int) {
        holder.bind(records[position], dateFormat, expandedSet.contains(position)) {
            if (expandedSet.contains(position)) expandedSet.remove(position)
            else expandedSet.add(position)
            notifyItemChanged(position)
        }
    }

    override fun getItemCount(): Int = records.size

    class HistoryViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val textTimestamp: TextView   = view.findViewById(R.id.text_timestamp)
        private val textSummary: TextView     = view.findViewById(R.id.text_summary)
        private val textExpand: TextView      = view.findViewById(R.id.text_expand)
        private val layoutNetworks: LinearLayout = view.findViewById(R.id.layout_networks)

        fun bind(
            record: ScanRecord,
            fmt: SimpleDateFormat,
            expanded: Boolean,
            onToggle: () -> Unit
        ) {
            textTimestamp.text = fmt.format(Date(record.timestampMs))
            val total   = record.networks.size
            val flagged = record.networks.count { it.isFlagged }
            textSummary.text = itemView.context.getString(R.string.history_summary, total, flagged)
            textExpand.text  = if (expanded) "▲" else "▼"

            layoutNetworks.removeAllViews()
            layoutNetworks.visibility = if (expanded) View.VISIBLE else View.GONE
            if (expanded) {
                record.networks.forEach { n -> addNetworkRow(layoutNetworks, n) }
            }
            itemView.setOnClickListener { onToggle() }
        }

        private fun addNetworkRow(container: LinearLayout, network: ScannedNetwork) {
            val ctx  = container.context
            val ssid = network.ssid.ifBlank { ctx.getString(R.string.hidden_ssid) }
            val sec  = WifiDisplayUtils.capabilitiesToSecurityLabel(network.capabilities)
            val band = WifiDisplayUtils.frequencyToBand(network.frequency)
            val ch   = WifiDisplayUtils.frequencyToChannel(network.frequency)
            val flag = if (network.isFlagged) "  ⚠" else ""
            val scale = ctx.resources.displayMetrics.density

            val rowText = "• $ssid  ${network.rssi} dBm  $sec  $band ch$ch$flag"
            val row = TextView(ctx).apply {
                text = rowText
                contentDescription = rowText
                textSize = 12f
                setPadding(0, (4 * scale + 0.5f).toInt(), 0, (2 * scale + 0.5f).toInt())
                if (network.isFlagged) setTextColor(ctx.getColor(R.color.status_error))
            }
            container.addView(row)

            if (network.isFlagged && network.threats.isNotEmpty()) {
                val threatText = network.threats.joinToString(" · ") { t ->
                    t.name.lowercase().replace('_', ' ')
                }
                val threats = TextView(ctx).apply {
                    text = "  $threatText"
                    contentDescription = "Threats: $threatText"
                    textSize = 11f
                    setPadding((16 * scale + 0.5f).toInt(), 0, 0, (4 * scale + 0.5f).toInt())
                    setTextColor(ctx.getColor(R.color.status_error))
                    alpha = 0.75f
                }
                container.addView(threats)
            }
        }
    }
}
