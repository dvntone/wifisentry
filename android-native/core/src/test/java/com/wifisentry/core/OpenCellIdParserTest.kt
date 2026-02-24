package com.wifisentry.core

import org.junit.Assert.*
import org.junit.Test

class OpenCellIdParserTest {

    private val HEADER = "radio,mcc,mnc,lac,cid,lon,lat,range,samples,changeable,created,updated,averageSignal"

    private fun csvWith(vararg rows: String) =
        (listOf(HEADER) + rows.toList()).joinToString("\n")

    @Test fun `parse single valid LTE row`() {
        val csv = csvWith("LTE,310,410,12345,67890,-87.6298,41.8781,1000,10,1,1609459200,1609459200,-85")
        val result = OpenCellIdParser.parse(csv)
        assertEquals(1, result.importedTowers)
        assertEquals(0, result.skippedRows)
        val tower = result.towers[0]
        assertEquals("LTE", tower.radio)
        assertEquals(310, tower.mcc)
        assertEquals(410, tower.mnc)
        assertEquals(12345, tower.lac)
        assertEquals(67890, tower.cid)
        assertEquals(-87.6298, tower.lon, 0.0001)
        assertEquals(41.8781, tower.lat, 0.0001)
        assertEquals(-85, tower.averageSignal)
    }

    @Test fun `header-only CSV returns empty result`() {
        val result = OpenCellIdParser.parse(HEADER)
        assertEquals(0, result.importedTowers)
    }

    @Test fun `rows with insufficient columns are skipped`() {
        val csv = csvWith("LTE,310,410")
        val result = OpenCellIdParser.parse(csv)
        assertEquals(0, result.importedTowers)
        assertEquals(1, result.skippedRows)
    }

    @Test fun `rows with non-numeric mcc are skipped`() {
        val csv = csvWith("LTE,notanumber,410,12345,67890,-87.6298,41.8781,1000,10,1,0,0,-85")
        val result = OpenCellIdParser.parse(csv)
        assertEquals(0, result.importedTowers)
        assertEquals(1, result.skippedRows)
    }

    @Test fun `multiple valid rows produce multiple towers`() {
        val csv = csvWith(
            "GSM,310,410,100,200,-87.6,41.8,500,5,1,0,0,-90",
            "LTE,310,260,300,400,-87.7,41.9,1000,20,1,0,0,-80"
        )
        val result = OpenCellIdParser.parse(csv)
        assertEquals(2, result.importedTowers)
        assertEquals(0, result.skippedRows)
    }

    @Test fun `CSV without radio header returns empty result`() {
        val csv = "not,a,valid,header\nsome,data,here"
        val result = OpenCellIdParser.parse(csv)
        assertEquals(0, result.importedTowers)
    }

    @Test fun `empty string returns empty result`() {
        assertEquals(0, OpenCellIdParser.parse("").importedTowers)
    }
}
