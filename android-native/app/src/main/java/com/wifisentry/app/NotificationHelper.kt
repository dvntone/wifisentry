package com.wifisentry.app

import android.content.Context
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Creates the app notification channel and posts threat-alert notifications.
 *
 * On Android 13+ (API 33+) the caller must have requested and received the
 * POST_NOTIFICATIONS permission before [notifyThreats] will have any effect;
 * [areNotificationsEnabled] returns false otherwise and no notification is posted.
 */
object NotificationHelper {

    private const val CHANNEL_ID      = "wifi_sentry_threats"
    private const val NOTIFICATION_ID = 1001

    /** Call once at app start (e.g. in Activity.onCreate) to register the channel. */
    fun createChannel(context: Context) {
        val channel = NotificationChannelCompat
            .Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_HIGH)
            .setName(context.getString(R.string.notification_channel_name))
            .setDescription(context.getString(R.string.notification_channel_desc))
            .build()
        NotificationManagerCompat.from(context).createNotificationChannel(channel)
    }

    /**
     * Post a high-priority notification reporting the number of flagged networks.
     * Does nothing when notifications are disabled by the user or OS.
     */
    fun notifyThreats(context: Context, flaggedCount: Int, totalCount: Int) {
        val nm = NotificationManagerCompat.from(context)
        if (!nm.areNotificationsEnabled()) return

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(context.getString(R.string.notification_title))
            .setContentText(
                context.getString(R.string.notification_text, flaggedCount, totalCount)
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        nm.notify(NOTIFICATION_ID, notification)
    }
}
