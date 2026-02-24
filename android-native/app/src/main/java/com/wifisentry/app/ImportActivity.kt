package com.wifisentry.app

import android.net.Uri
import android.os.Bundle
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.wifisentry.app.databinding.ActivityImportBinding
import com.wifisentry.core.CellTowerStorage
import com.wifisentry.core.OpenCellIdParser
import com.wifisentry.core.ScanStorage
import com.wifisentry.core.WigleParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Lets users seed the heuristics engine with data from existing WiGLE or
 * OpenCellID CSV exports.  Imported networks are merged into [ScanStorage]
 * so all 13 [ThreatAnalyzer] checks immediately benefit from the historical
 * data, dramatically improving evil-twin, beacon-flood, and near-clone
 * detection from the very first live scan.
 *
 * File access uses the Storage Access Framework [GetContent] contract — no
 * extra manifest permissions are required.
 */
class ImportActivity : AppCompatActivity() {

    private lateinit var binding: ActivityImportBinding

    // ── SAF file pickers ──────────────────────────────────────────────────

    private val pickWigle = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri -> if (uri != null) importWigle(uri) }

    private val pickOpenCellId = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri -> if (uri != null) importOpenCellId(uri) }

    // ── lifecycle ─────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityImportBinding.inflate(layoutInflater)
        setContentView(binding.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        title = getString(R.string.import_title)

        binding.buttonImportWigle.setOnClickListener {
            pickWigle.launch("text/*")
        }
        binding.buttonImportOpenCellId.setOnClickListener {
            pickOpenCellId.launch("text/*")
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }

    // ── import workers ────────────────────────────────────────────────────

    private fun importWigle(uri: Uri) {
        setLoading(true)
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val csv = contentResolver.openInputStream(uri)
                        ?.bufferedReader()?.readText() ?: return@runCatching null
                    val parsed  = WigleParser.parse(csv)
                    val storage = ScanStorage(applicationContext)
                    val added   = storage.importWigleRecords(parsed.records)
                    Triple(added, parsed.importedNetworks, parsed.skippedRows)
                }
            }
            setLoading(false)
            result.getOrNull()?.let { (added, total, skipped) ->
                showResult(
                    getString(R.string.import_wigle_success, added, total, skipped)
                )
            } ?: showError(getString(R.string.import_error_read))
        }
    }

    private fun importOpenCellId(uri: Uri) {
        setLoading(true)
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val csv = contentResolver.openInputStream(uri)
                        ?.bufferedReader()?.readText() ?: return@runCatching null
                    val parsed  = OpenCellIdParser.parse(csv)
                    val storage = CellTowerStorage(applicationContext)
                    val added   = storage.importTowers(parsed.towers)
                    Triple(added, parsed.importedTowers, parsed.skippedRows)
                }
            }
            setLoading(false)
            result.getOrNull()?.let { (added, total, skipped) ->
                showResult(
                    getString(R.string.import_opencellid_success, added, total, skipped)
                )
            } ?: showError(getString(R.string.import_error_read))
        }
    }

    // ── UI helpers ────────────────────────────────────────────────────────

    private fun setLoading(loading: Boolean) {
        binding.progressImport.visibility        = if (loading) View.VISIBLE else View.GONE
        binding.buttonImportWigle.isEnabled      = !loading
        binding.buttonImportOpenCellId.isEnabled = !loading
        binding.textImportStatus.text            = if (loading) getString(R.string.import_loading) else ""
    }

    private fun showResult(message: String) {
        binding.textImportStatus.text = message
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.import_result_title)
            .setMessage(message)
            .setPositiveButton(R.string.dialog_close, null)
            .show()
    }

    private fun showError(message: String) {
        binding.textImportStatus.text = message
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.import_error_title)
            .setMessage(message)
            .setPositiveButton(R.string.dialog_close, null)
            .show()
    }
}
