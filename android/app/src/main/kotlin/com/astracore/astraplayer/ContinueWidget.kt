package com.astracore.astraplayer

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File

/** Home screen widget: the last watched video with its progress. Tap it to resume. */
class ContinueWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) { for (id in ids) mgr.updateAppWidget(id, views(context)) }

    companion object {
        fun refresh(ctx: Context) {
            try {
                val m = AppWidgetManager.getInstance(ctx)
                val ids = m.getAppWidgetIds(ComponentName(ctx, ContinueWidget::class.java))
                if (ids.isNotEmpty()) for (id in ids) m.updateAppWidget(id, views(ctx))
            } catch (e: Exception) { }
        }

        private fun nice(n: String): String = n.substringBeforeLast('.').replace(Regex("\\[.*?]|\\(.*?\\)"), " ").replace('_', ' ').replace('.', ' ').replace(Regex("\\s+"), " ").trim()

        private fun views(ctx: Context): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_continue)
            try {
                val f = File(Storage.data(ctx), "history.json")
                if (f.exists()) {
                    val h = JSONObject(f.readText()); var best: JSONObject? = null
                    h.keys().forEach { k -> val e = h.optJSONObject(k) ?: return@forEach; if (best == null || e.optLong("updated") > best!!.optLong("updated")) best = e }
                    best?.let { e ->
                        v.setTextViewText(R.id.w_title, nice(e.optString("name")))
                        val t = e.optLong("time"); val d = e.optLong("dur")
                        v.setTextViewText(R.id.w_sub, if (d > 0) "%d:%02d / %d:%02d".format(t / 60, t % 60, d / 60, d % 60) else "Tap to resume")
                        v.setProgressBar(R.id.w_bar, 100, e.optInt("percent"), false)
                    }
                }
            } catch (e: Exception) { }
            val i = Intent(ctx, MainActivity::class.java).setAction("com.astracore.astraplayer.GO").putExtra("go", "resume").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            val pi = PendingIntent.getActivity(ctx, 77, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            v.setOnClickPendingIntent(R.id.w_root, pi)
            return v
        }
    }
}
