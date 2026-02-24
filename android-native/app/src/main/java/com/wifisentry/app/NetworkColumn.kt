package com.wifisentry.app

/**
 * Optional data columns that can be shown or hidden via the ⋮ column menu.
 *
 * SSID and Signal are always visible and are not in this enum.
 *
 * Column design is influenced by WiGLE's row layout which always shows:
 * SSID, OUI/Manufacturer, Signal (color-coded), MAC address, Channel/Frequency,
 * and Security capabilities. We expose the same data set and let the user
 * decide which columns they need on screen.
 */
enum class NetworkColumn {
    /** MAC address row (BSSID + manufacturer from OUI lookup). */
    BSSID,
    /**
     * Channel + band label (e.g. "ch6 · 2.4 GHz").
     * WiGLE considers this core data; we default it visible but allow hiding.
     */
    CHANNEL,
    /** Full security capabilities string (e.g. "[WPA2][RSN][ESS]"). */
    SECURITY_TEXT,
    /** Estimated distance derived from RSSI. */
    DISTANCE,
    /** Threat-type detail row (only visible on flagged networks). */
    THREATS,
}

/** All optional columns visible by default. */
val ALL_COLUMNS: Set<NetworkColumn> = NetworkColumn.entries.toSet()

/**
 * Column by which the network list is sorted.
 *
 * Sort options are modelled after WiGLE's [NetworkListSorter] (Signal, Channel,
 * Crypto/Security, SSID) extended with our own Threat-severity sort.
 *
 * @property defaultAscending  Direction used when first activating this column.
 *   Signal and Threat start descending (most relevant first); SSID and Channel
 *   start ascending.
 */
enum class SortColumn(val defaultAscending: Boolean) {
    /** Highest-severity threats first, then by signal strength (default). */
    THREAT(defaultAscending = true),
    /** Strongest signal first (WiGLE's default sort). */
    SIGNAL(defaultAscending = true),
    /** Alphabetical by SSID (A → Z). */
    SSID(defaultAscending = true),
    /** Ascending channel / frequency number (WiGLE: channelCompare). */
    CHANNEL(defaultAscending = true),
}
