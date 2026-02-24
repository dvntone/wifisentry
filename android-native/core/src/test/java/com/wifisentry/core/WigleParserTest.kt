package com.wifisentry.core

import org.junit.Assert.*
import org.junit.Test

class WigleParserTest {

    private val HEADER_LINE   = "WigleWifi-1.4,appRelease=1.0,model=Test"
    private val COLUMN_HEADER = "MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type"

    private fun csvWith(vararg rows: String) =
        (listOf(HEADER_LINE, COLUMN_HEADER) + rows.toList()).joinToString("\n")

    // ── CSV tokeniser ──────────────────────────────────────────────────────

    @Test fun `tokenise plain row`() {
        val result = WigleParser.tokenise("a,b,c")
        assertEquals(listOf("a", "b", "c"), result)
    }

    @Test fun `tokenise quoted field with comma`() {
        val result = WigleParser.tokenise("a,\"b,c\",d")
        assertEquals(listOf("a", "b,c", "d"), result)
    }

    @Test fun `tokenise escaped quote inside field`() {
        val result = WigleParser.tokenise("\"a\"\"b\",c")
        assertEquals(listOf("a\"b", "c"), result)
    }

    // ── channelToFreq ──────────────────────────────────────────────────────

    @Test fun `channel 6 maps to 2437 MHz`() {
        assertEquals(2437, WigleParser.channelToFreq(6))
    }

    @Test fun `channel 36 maps to 5180 MHz`() {
        assertEquals(5180, WigleParser.channelToFreq(36))
    }

    @Test fun `channel 14 maps to 2484 MHz`() {
        assertEquals(2484, WigleParser.channelToFreq(14))
    }

    // ── parse happy path ───────────────────────────────────────────────────

    @Test fun `parse single WIFI row produces one record`() {
        val csv = csvWith(
            "AA:BB:CC:DD:EE:FF,\"My Network\",\"[WPA2][RSN][ESS]\",2024-01-15 10:30:00,6,-65,37.7749,-122.4194,10.0,5.0,WIFI"
        )
        val result = WigleParser.parse(csv)
        assertEquals(1, result.records.size)
        assertEquals(1, result.importedNetworks)
        assertEquals(0, result.skippedRows)
        val network = result.records[0].networks[0]
        assertEquals("My Network", network.ssid)
        assertEquals("AA:BB:CC:DD:EE:FF", network.bssid)
        assertEquals(-65, network.rssi)
        assertEquals(2437, network.frequency)
    }

    @Test fun `non-WIFI rows are skipped`() {
        val csv = csvWith(
            "AA:BB:CC:DD:EE:FF,\"BT Device\",,2024-01-15 10:30:00,0,-70,0.0,0.0,0.0,0.0,BT"
        )
        val result = WigleParser.parse(csv)
        assertEquals(0, result.importedNetworks)
        assertEquals(1, result.skippedRows)
    }

    @Test fun `rows with missing MAC are skipped`() {
        val csv = csvWith(
            ",\"Test\",\"[WPA2]\",2024-01-15 10:30:00,6,-65,0.0,0.0,0.0,0.0,WIFI"
        )
        val result = WigleParser.parse(csv)
        assertEquals(0, result.importedNetworks)
        assertEquals(1, result.skippedRows)
    }

    @Test fun `rows with unparseable date are skipped`() {
        val csv = csvWith(
            "AA:BB:CC:DD:EE:FF,\"Test\",\"[WPA2]\",not-a-date,6,-65,0.0,0.0,0.0,0.0,WIFI"
        )
        val result = WigleParser.parse(csv)
        assertEquals(0, result.importedNetworks)
        assertEquals(1, result.skippedRows)
    }

    @Test fun `two rows on same UTC day produce one ScanRecord`() {
        val csv = csvWith(
            "AA:BB:CC:DD:EE:FF,\"Net1\",\"[WPA2]\",2024-01-15 08:00:00,6,-65,0.0,0.0,0.0,0.0,WIFI",
            "11:22:33:44:55:66,\"Net2\",\"[WPA2]\",2024-01-15 20:00:00,6,-70,0.0,0.0,0.0,0.0,WIFI"
        )
        val result = WigleParser.parse(csv)
        assertEquals(1, result.records.size)
        assertEquals(2, result.importedNetworks)
        assertEquals(2, result.records[0].networks.size)
    }

    @Test fun `rows on different UTC days produce separate ScanRecords`() {
        val csv = csvWith(
            "AA:BB:CC:DD:EE:FF,\"Net1\",\"[WPA2]\",2024-01-15 10:00:00,6,-65,0.0,0.0,0.0,0.0,WIFI",
            "11:22:33:44:55:66,\"Net2\",\"[WPA2]\",2024-01-16 10:00:00,6,-70,0.0,0.0,0.0,0.0,WIFI"
        )
        val result = WigleParser.parse(csv)
        assertEquals(2, result.records.size)
        assertEquals(2, result.importedNetworks)
    }

    @Test fun `empty or header-only CSV returns empty result`() {
        assertEquals(0, WigleParser.parse("").importedNetworks)
        assertEquals(0, WigleParser.parse(HEADER_LINE + "\n" + COLUMN_HEADER).importedNetworks)
    }
}
