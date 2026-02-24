package com.wifisentry.app

import android.content.Context
import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.wifisentry.core.ScannedNetwork
import com.wifisentry.core.ThreatType
import com.wifisentry.core.WifiDisplayUtils

class ScanResultAdapter :
    ListAdapter<ScannedNetwork, ScanResultAdapter.NetworkViewHolder>(DIFF_CALLBACK) {

    var onNetworkClick: ((ScannedNetwork) -> Unit)? = null

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): NetworkViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_network, parent, false)
        return NetworkViewHolder(view)
    }

    override fun onBindViewHolder(holder: NetworkViewHolder, position: Int) {
        holder.bind(getItem(position), onNetworkClick)
    }

    class NetworkViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val textSsid: TextView        = itemView.findViewById(R.id.text_ssid)
        private val textBssid: TextView       = itemView.findViewById(R.id.text_bssid)
        private val textSignal: TextView      = itemView.findViewById(R.id.text_signal)
        private val textSecurity: TextView    = itemView.findViewById(R.id.text_security)
        private val textThreats: TextView     = itemView.findViewById(R.id.text_threats)
        private val textBadge: TextView       = itemView.findViewById(R.id.text_security_badge)
        private val flagIndicator: View       = itemView.findViewById(R.id.flag_indicator)

        fun bind(network: ScannedNetwork, onClick: ((ScannedNetwork) -> Unit)?) {
            val ctx: Context = itemView.context

            textSsid.text    = network.ssid.ifBlank { ctx.getString(R.string.hidden_ssid) }
            textBssid.text   = network.bssid
            textSignal.text  = ctx.getString(R.string.signal_format, network.rssi)
            textSecurity.text = if (network.isOpen)
                ctx.getString(R.string.security_open)
            else
                network.capabilities

            // RSSI color: green / amber / red (inspired by WiGLE + GhostESP-Companion)
            val signalColor = when {
                network.rssi >= -55 -> ContextCompat.getColor(ctx, R.color.signal_good)
                network.rssi >= -70 -> ContextCompat.getColor(ctx, R.color.signal_fair)
                else                -> ContextCompat.getColor(ctx, R.color.signal_weak)
            }
            textSignal.setTextColor(signalColor)

            // Security badge (WPA3 / WPA2 / WEP / Open)
            val secLabel = WifiDisplayUtils.capabilitiesToSecurityLabel(network.capabilities)
            textBadge.text = secLabel
            val badgeColor = when {
                secLabel.startsWith("WPA3")  -> ContextCompat.getColor(ctx, R.color.badge_wpa3)
                secLabel.startsWith("WPA2")  -> ContextCompat.getColor(ctx, R.color.badge_wpa)
                secLabel.startsWith("WPA")   -> ContextCompat.getColor(ctx, R.color.badge_wpa)
                secLabel == "WEP (insecure)" -> ContextCompat.getColor(ctx, R.color.badge_wep)
                else                         -> ContextCompat.getColor(ctx, R.color.badge_open)
            }
            (textBadge.background.mutate() as? android.graphics.drawable.GradientDrawable)
                ?.setColor(badgeColor)

            if (network.isFlagged) {
                flagIndicator.visibility = View.VISIBLE
                textThreats.visibility   = View.VISIBLE
                textThreats.text = network.threats.joinToString(" · ") { it.displayName(ctx) }
                itemView.setBackgroundColor(ctx.getColor(R.color.flag_background))
                itemView.setOnClickListener { onClick?.invoke(network) }
            } else {
                flagIndicator.visibility = View.GONE
                textThreats.visibility   = View.GONE
                itemView.setBackgroundColor(Color.TRANSPARENT)
                itemView.setOnClickListener(null)
            }
        }
    }

    companion object {
        private val DIFF_CALLBACK = object : DiffUtil.ItemCallback<ScannedNetwork>() {
            override fun areItemsTheSame(old: ScannedNetwork, new: ScannedNetwork) =
                old.bssid == new.bssid
            override fun areContentsTheSame(old: ScannedNetwork, new: ScannedNetwork) =
                old == new
        }
    }
}

internal fun ThreatType.displayName(ctx: Context): String = when (this) {
    ThreatType.OPEN_NETWORK              -> ctx.getString(R.string.threat_open)
    ThreatType.SUSPICIOUS_SSID           -> ctx.getString(R.string.threat_suspicious_ssid)
    ThreatType.MULTIPLE_BSSIDS           -> ctx.getString(R.string.threat_multiple_bssids)
    ThreatType.SECURITY_CHANGE           -> ctx.getString(R.string.threat_security_change)
    ThreatType.EVIL_TWIN                 -> ctx.getString(R.string.threat_evil_twin)
    ThreatType.MAC_SPOOFING_SUSPECTED    -> ctx.getString(R.string.threat_mac_spoofing)
    ThreatType.SUSPICIOUS_SIGNAL_STRENGTH -> ctx.getString(R.string.threat_suspicious_signal)
    ThreatType.MULTI_SSID_SAME_OUI       -> ctx.getString(R.string.threat_multi_ssid_same_oui)
    ThreatType.BEACON_FLOOD              -> ctx.getString(R.string.threat_beacon_flood)
    ThreatType.INCONSISTENT_CAPABILITIES -> ctx.getString(R.string.threat_inconsistent_capabilities)
    ThreatType.BSSID_NEAR_CLONE          -> ctx.getString(R.string.threat_bssid_near_clone)
    ThreatType.WPS_VULNERABLE            -> ctx.getString(R.string.threat_wps_vulnerable)
    ThreatType.CHANNEL_SHIFT             -> ctx.getString(R.string.threat_channel_shift)
    ThreatType.DEAUTH_FLOOD              -> ctx.getString(R.string.threat_deauth_flood)
    ThreatType.PROBE_RESPONSE_ANOMALY    -> ctx.getString(R.string.threat_probe_response_anomaly)
}

internal fun ThreatType.detailDescription(ctx: Context): String = when (this) {
    ThreatType.OPEN_NETWORK              -> ctx.getString(R.string.threat_detail_open_network)
    ThreatType.SUSPICIOUS_SSID           -> ctx.getString(R.string.threat_detail_suspicious_ssid)
    ThreatType.MULTIPLE_BSSIDS           -> ctx.getString(R.string.threat_detail_multiple_bssids)
    ThreatType.SECURITY_CHANGE           -> ctx.getString(R.string.threat_detail_security_change)
    ThreatType.EVIL_TWIN                 -> ctx.getString(R.string.threat_detail_evil_twin)
    ThreatType.MAC_SPOOFING_SUSPECTED    -> ctx.getString(R.string.threat_detail_mac_spoofing)
    ThreatType.SUSPICIOUS_SIGNAL_STRENGTH -> ctx.getString(R.string.threat_detail_suspicious_signal)
    ThreatType.MULTI_SSID_SAME_OUI       -> ctx.getString(R.string.threat_detail_multi_ssid_same_oui)
    ThreatType.BEACON_FLOOD              -> ctx.getString(R.string.threat_detail_beacon_flood)
    ThreatType.INCONSISTENT_CAPABILITIES -> ctx.getString(R.string.threat_detail_inconsistent_capabilities)
    ThreatType.BSSID_NEAR_CLONE          -> ctx.getString(R.string.threat_detail_bssid_near_clone)
    ThreatType.WPS_VULNERABLE            -> ctx.getString(R.string.threat_detail_wps_vulnerable)
    ThreatType.CHANNEL_SHIFT             -> ctx.getString(R.string.threat_detail_channel_shift)
    ThreatType.DEAUTH_FLOOD              -> ctx.getString(R.string.threat_detail_deauth_flood)
    ThreatType.PROBE_RESPONSE_ANOMALY    -> ctx.getString(R.string.threat_detail_probe_response_anomaly)
}
