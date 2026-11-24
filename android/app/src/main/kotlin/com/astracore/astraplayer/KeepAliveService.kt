package com.astracore.astraplayer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper

/**
 * Keeps the app process alive while AI subtitles are being made, so Android does not close the app
 * when you leave it. It stops itself as soon as nothing is running.
 */
class KeepAliveService : Service() {
    private val h = Handler(Looper.getMainLooper())
    private val check = object : Runnable {
        override fun run() {
            val n = AiSubs.liveCount()
            if (n <= 0 && !MainActivity.alive) { stopForeground(true); stopSelf(); return }
            notify(n)
            h.postDelayed(this, 4000)
        }
    }

    private fun notify(n: Int) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(7, build(n))
    }

    private fun build(n: Int): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel("astra_bg") == null)
            nm.createNotificationChannel(NotificationChannel("astra_bg", "Background work", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "astra_bg") else @Suppress("DEPRECATION") Notification.Builder(this)
        return b.setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("Astra Player")
            .setContentText(AiSubs.textNow().ifEmpty { "Running in the background" }).setOngoing(true).setContentIntent(open).build()
    }

    override fun onStartCommand(i: Intent?, f: Int, id: Int): Int {
        val nt = build(AiSubs.liveCount())
        if (Build.VERSION.SDK_INT >= 29) startForeground(7, nt, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC) else startForeground(7, nt)
        h.removeCallbacks(check); h.postDelayed(check, 1500)
        return START_STICKY
    }

    override fun onDestroy() { h.removeCallbacksAndMessages(null); super.onDestroy() }
    override fun onBind(i: Intent?): IBinder? = null
}
