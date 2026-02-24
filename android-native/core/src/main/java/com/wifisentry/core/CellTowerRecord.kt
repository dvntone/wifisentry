package com.wifisentry.core

/**
 * A single cell tower entry from an OpenCellID / Mozilla Location Service export.
 *
 * Field names and units match the OpenCellID CSV schema:
 * https://wiki.opencellid.org/wiki/API#Getting_the_list_of_cells
 */
data class CellTowerRecord(
    /** Radio type: "GSM", "UMTS", "LTE", "NR", "CDMA". */
    val radio: String,
    /** Mobile Country Code. */
    val mcc: Int,
    /** Mobile Network Code. */
    val mnc: Int,
    /** Location Area Code (GSM/UMTS) or Tracking Area Code (LTE). */
    val lac: Int,
    /** Cell ID. */
    val cid: Int,
    /** WGS-84 longitude in decimal degrees. */
    val lon: Double,
    /** WGS-84 latitude in decimal degrees. */
    val lat: Double,
    /** Estimated coverage radius in metres. */
    val rangeMeters: Int = 0,
    /** Number of measurement samples. */
    val samples: Int = 0,
    /** Average signal strength in dBm (negative). */
    val averageSignal: Int = 0,
)
