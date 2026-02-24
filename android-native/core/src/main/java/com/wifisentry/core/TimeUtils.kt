package com.wifisentry.core

import java.util.Calendar
import java.util.Date
import java.util.TimeZone

/**
 * Returns the UTC epoch-millisecond timestamp for the start (midnight) of the
 * calendar day containing [epochMs].
 *
 * Shared by [ScanStorage.importWigleRecords] and [WigleParser] so that both
 * bucket records by the same UTC-day key, ensuring correct deduplication
 * across import and storage.
 */
internal fun utcDayBucketMs(epochMs: Long): Long {
    val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
    cal.time = Date(epochMs)
    cal.set(Calendar.HOUR_OF_DAY, 0)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.timeInMillis
}
