package com.wifisentry.app

import android.content.Context
import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.wifisentry.core.ScannedNetwork
import com.wifisentry.core.ThreatType

class ScanResultAdapter :
    ListAdapter<ScannedNetwork, ScanResultAdapter.NetworkViewHolder>(DIFF_CALLBACK) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): NetworkViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_network, parent, false)
        return NetworkViewHolder(view)
    }

    override fun onBindViewHolder(holder: NetworkViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class NetworkViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val textSsid: TextView = itemView.findViewById(R.id.text_ssid)
        private val textBssid: TextView = itemView.findViewById(R.id.text_bssid)
        private val textSignal: TextView = itemView.findViewById(R.id.text_signal)
        private val textSecurity: TextView = itemView.findViewById(R.id.text_security)
        private val textThreats: TextView = itemView.findViewById(R.id.text_threats)
        private val flagIndicator: View = itemView.findViewById(R.id.flag_indicator)

        fun bind(network: ScannedNetwork) {
            val ctx: Context = itemView.context

            textSsid.text = network.ssid.ifBlank { ctx.getString(R.string.hidden_ssid) }
            textBssid.text = network.bssid
            textSignal.text = ctx.getString(R.string.signal_format, network.rssi)
            textSecurity.text = if (network.isOpen)
                ctx.getString(R.string.security_open)
            else
                network.capabilities

            if (network.isFlagged) {
                flagIndicator.visibility = View.VISIBLE
                textThreats.visibility = View.VISIBLE
                textThreats.text = network.threats.joinToString(" · ") { it.displayName(ctx) }
                itemView.setBackgroundColor(Color.parseColor("#FFF8E1"))
            } else {
                flagIndicator.visibility = View.GONE
                textThreats.visibility = View.GONE
                itemView.setBackgroundColor(Color.TRANSPARENT)
            }
        }
    }

    companion object {
        private val DIFF_CALLBACK = object : DiffUtil.ItemCallback<ScannedNetwork>() {
            override fun areItemsTheSame(old: ScannedNetwork, new: ScannedNetwork): Boolean =
                old.bssid == new.bssid

            override fun areContentsTheSame(old: ScannedNetwork, new: ScannedNetwork): Boolean =
                old == new
        }
    }
}

private fun ThreatType.displayName(ctx: Context): String = when (this) {
    ThreatType.OPEN_NETWORK -> ctx.getString(R.string.threat_open)
    ThreatType.SUSPICIOUS_SSID -> ctx.getString(R.string.threat_suspicious_ssid)
    ThreatType.MULTIPLE_BSSIDS -> ctx.getString(R.string.threat_multiple_bssids)
    ThreatType.SECURITY_CHANGE -> ctx.getString(R.string.threat_security_change)
}
