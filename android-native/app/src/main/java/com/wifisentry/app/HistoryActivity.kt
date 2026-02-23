package com.wifisentry.app

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.wifisentry.app.databinding.ActivityHistoryBinding
import com.wifisentry.core.ScanStorage
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
            binding.textEmpty.visibility = View.VISIBLE
            binding.recyclerHistory.visibility = View.GONE
            return
        }

        binding.textEmpty.visibility = View.GONE
        binding.recyclerHistory.visibility = View.VISIBLE
        binding.recyclerHistory.layoutManager = LinearLayoutManager(this)

        val adapter = HistoryAdapter(history)
        binding.recyclerHistory.adapter = adapter
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}

private class HistoryAdapter(
    private val records: List<com.wifisentry.core.ScanRecord>
) : androidx.recyclerview.widget.RecyclerView.Adapter<HistoryAdapter.HistoryViewHolder>() {

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())

    override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int): HistoryViewHolder {
        val view = android.view.LayoutInflater.from(parent.context)
            .inflate(R.layout.item_history_record, parent, false)
        return HistoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: HistoryViewHolder, position: Int) {
        holder.bind(records[position], dateFormat)
    }

    override fun getItemCount(): Int = records.size

    class HistoryViewHolder(view: android.view.View) :
        androidx.recyclerview.widget.RecyclerView.ViewHolder(view) {
        private val textTimestamp: android.widget.TextView =
            view.findViewById(R.id.text_timestamp)
        private val textSummary: android.widget.TextView =
            view.findViewById(R.id.text_summary)

        fun bind(record: com.wifisentry.core.ScanRecord, fmt: SimpleDateFormat) {
            textTimestamp.text = fmt.format(Date(record.timestampMs))
            val total = record.networks.size
            val flagged = record.networks.count { it.isFlagged }
            textSummary.text = itemView.context.getString(
                R.string.history_summary, total, flagged
            )
        }
    }
}
