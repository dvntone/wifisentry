package com.wifisentry.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wifisentry.core.ScannedNetwork
import com.wifisentry.core.ShizukuWifiScanner
import com.wifisentry.core.ThreatSeverity
import com.wifisentry.core.ThreatType
import com.wifisentry.core.severity

// ── WiFi Sentry terminal-aesthetic colour tokens ──────────────────────────────

private val NeonGreen  = Color(0xFF00FF9C)
private val NeonRed    = Color(0xFFFF3B3B)
private val NeonOrange = Color(0xFFFF9500)
private val NeonAmber  = Color(0xFFFFCC00)
private val DarkBg     = Color(0xFF0A0E14)
private val DarkSurface = Color(0xFF111820)
private val DarkCard   = Color(0xFF1A2332)

private val WifiSentryDarkColorScheme = darkColorScheme(
    primary          = NeonGreen,
    onPrimary        = DarkBg,
    secondary        = NeonOrange,
    onSecondary      = DarkBg,
    background       = DarkBg,
    onBackground     = NeonGreen,
    surface          = DarkSurface,
    onSurface        = Color(0xFFB0C4D8),
    surfaceVariant   = DarkCard,
    onSurfaceVariant = Color(0xFF8899AA),
    error            = NeonRed,
    onError          = DarkBg,
)

private val WifiSentryLightColorScheme = lightColorScheme(
    primary          = Color(0xFF006B3C),
    onPrimary        = Color.White,
    secondary        = Color(0xFF7A4100),
    onSecondary      = Color.White,
    background       = Color(0xFFF0F4F8),
    onBackground     = Color(0xFF1A1A2E),
    surface          = Color.White,
    onSurface        = Color(0xFF1A1A2E),
    surfaceVariant   = Color(0xFFDDE3EA),
    onSurfaceVariant = Color(0xFF44546F),
    error            = Color(0xFFBA1A1A),
    onError          = Color.White,
)

// ── Activity ──────────────────────────────────────────────────────────────────

/**
 * Compose-based network dashboard Activity.
 *
 * Provides a terminal-aesthetic UI with:
 * - Light / Dark mode toggle
 * - Real-time network list with colour-coded threat severity
 * - Scan control buttons (Start / Stop / Single scan)
 * - Shizuku privilege status indicator
 */
class ComposeDashboardActivity : ComponentActivity() {

    private val viewModel: DashboardViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            var darkMode by remember { mutableStateOf(true) }
            WifiSentryTheme(darkTheme = darkMode) {
                val uiState by viewModel.uiState.collectAsState()
                DashboardScreen(
                    uiState      = uiState,
                    darkMode     = darkMode,
                    onToggleTheme = { darkMode = !darkMode },
                    onStartScan  = { viewModel.startMonitoring() },
                    onStopScan   = { viewModel.stopMonitoring() },
                    onSingleScan = { viewModel.triggerSingleScan() },
                )
            }
        }
    }
}

// ── Theme ─────────────────────────────────────────────────────────────────────

@Composable
fun WifiSentryTheme(darkTheme: Boolean = true, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) WifiSentryDarkColorScheme else WifiSentryLightColorScheme,
        typography  = MaterialTheme.typography,
        content     = content,
    )
}

// ── Screen ────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    uiState: DashboardUiState,
    darkMode: Boolean,
    onToggleTheme: () -> Unit,
    onStartScan: () -> Unit,
    onStopScan: () -> Unit,
    onSingleScan: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text       = "WiFi Sentry",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color      = MaterialTheme.colorScheme.primary,
                    )
                },
                actions = {
                    // Light / Dark toggle
                    IconButton(onClick = onToggleTheme) {
                        Text(
                            text      = if (darkMode) "☀" else "🌙",
                            fontSize  = 20.sp,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
            )
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(paddingValues),
        ) {
            // Status bar
            PrivilegeStatusBar(uiState)

            // Error banner
            uiState.errorMessage?.let { error ->
                Text(
                    text     = "⚠ $error",
                    color    = MaterialTheme.colorScheme.error,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.error.copy(alpha = 0.15f))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    fontFamily = FontFamily.Monospace,
                    fontSize   = 12.sp,
                )
            }

            // Control buttons
            ScanControls(
                isScanning   = uiState.isScanning,
                onStartScan  = onStartScan,
                onStopScan   = onStopScan,
                onSingleScan = onSingleScan,
            )

            // Network count header
            ScanSummaryHeader(networks = uiState.networks)

            // Network list
            NetworkList(networks = uiState.networks)
        }
    }
}

@Composable
private fun PrivilegeStatusBar(uiState: DashboardUiState) {
    val (statusText, statusColor) = when {
        uiState.shizukuActive && uiState.privilegeUid == ShizukuWifiScanner.ADB_SHELL_UID ->
            "● SHIZUKU: ADB SHELL (UID 2000) — UNTHROTTLED" to NeonGreen
        uiState.shizukuActive && uiState.privilegeUid == ShizukuWifiScanner.ROOT_UID ->
            "● SHIZUKU: ROOT (UID 0) — UNTHROTTLED" to NeonGreen
        else ->
            "● STANDARD WIFI — THROTTLED (4 scans/2 min)" to NeonAmber
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text       = statusText,
            color      = statusColor,
            fontFamily = FontFamily.Monospace,
            fontSize   = 11.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun ScanControls(
    isScanning: Boolean,
    onStartScan: () -> Unit,
    onStopScan: () -> Unit,
    onSingleScan: () -> Unit,
) {
    Row(
        modifier            = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (!isScanning) {
            Button(
                onClick = onStartScan,
                colors  = ButtonDefaults.buttonColors(containerColor = NeonGreen),
                modifier = Modifier.weight(1f),
            ) {
                Text("▶ MONITOR", fontFamily = FontFamily.Monospace, color = DarkBg)
            }
        } else {
            Button(
                onClick = onStopScan,
                colors  = ButtonDefaults.buttonColors(containerColor = NeonRed),
                modifier = Modifier.weight(1f),
            ) {
                Text("■ STOP", fontFamily = FontFamily.Monospace, color = Color.White)
            }
        }
        Button(
            onClick  = onSingleScan,
            colors   = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            modifier = Modifier.weight(1f),
        ) {
            Text(
                text       = "⟳ SCAN",
                fontFamily = FontFamily.Monospace,
                color      = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ScanSummaryHeader(networks: List<ScannedNetwork>) {
    val flagged = networks.count { it.isFlagged }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text       = "${networks.size} NETWORKS",
            fontFamily = FontFamily.Monospace,
            fontSize   = 12.sp,
            color      = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (flagged > 0) {
            Text(
                text       = "$flagged THREATS",
                fontFamily = FontFamily.Monospace,
                fontSize   = 12.sp,
                color      = NeonRed,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun NetworkList(networks: List<ScannedNetwork>) {
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        items(
            items = networks.sortedWith(
                compareByDescending<ScannedNetwork> { it.isFlagged }
                    .thenByDescending { it.rssi }
            ),
            key = { it.bssid + it.ssid },
        ) { network ->
            NetworkCard(network)
        }
    }
}

@Composable
private fun NetworkCard(network: ScannedNetwork) {
    val borderColor = when (network.highestSeverity) {
        ThreatSeverity.HIGH   -> NeonRed
        ThreatSeverity.MEDIUM -> NeonOrange
        ThreatSeverity.LOW    -> NeonAmber
        null                  -> Color.Transparent
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape    = RoundedCornerShape(6.dp),
        colors   = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        border   = if (network.isFlagged) {
            androidx.compose.foundation.BorderStroke(1.dp, borderColor)
        } else null,
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // SSID + RSSI row
            Row(
                modifier              = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment     = Alignment.CenterVertically,
            ) {
                Text(
                    text       = if (network.ssid.isBlank()) "<hidden>" else network.ssid,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    color      = MaterialTheme.colorScheme.onSurface,
                    fontSize   = 14.sp,
                    maxLines   = 1,
                    overflow   = TextOverflow.Ellipsis,
                    modifier   = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text       = "${network.rssi} dBm",
                    fontFamily = FontFamily.Monospace,
                    fontSize   = 11.sp,
                    color      = rssiColor(network.rssi),
                )
            }

            // BSSID row
            Text(
                text       = network.bssid,
                fontFamily = FontFamily.Monospace,
                fontSize   = 11.sp,
                color      = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            // Threat chips
            if (network.threats.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    network.threats.forEach { threat ->
                        ThreatChip(threat)
                    }
                }
            }
        }
    }
}

@Composable
private fun ThreatChip(threat: ThreatType) {
    val color = when (threat.severity) {
        ThreatSeverity.HIGH   -> NeonRed
        ThreatSeverity.MEDIUM -> NeonOrange
        ThreatSeverity.LOW    -> NeonAmber
    }
    Box(
        modifier = Modifier
            .background(color.copy(alpha = 0.18f), RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(
            text       = threat.name,
            fontFamily = FontFamily.Monospace,
            fontSize   = 9.sp,
            color      = color,
            fontWeight = FontWeight.Bold,
        )
    }
}

private fun rssiColor(rssi: Int): Color = when {
    rssi >= -60 -> NeonGreen
    rssi >= -75 -> NeonAmber
    else        -> NeonRed
}
