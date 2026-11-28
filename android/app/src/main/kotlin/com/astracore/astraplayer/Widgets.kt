package com.astracore.astraplayer

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.util.Calendar

/** Shared helpers for all home screen widgets. */
object Wdg {
    private const val ACTION = "com.astracore.astraplayer.GO"
    private var lastRefresh = 0L

    fun go(ctx: Context, code: Int, where: String): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java).setAction(ACTION).putExtra("go", where)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun nice(n: String): String = n.substringBeforeLast('.').replace(Regex("\\[.*?]|\\(.*?\\)"), " ").replace('_', ' ').replace('.', ' ').replace(Regex("\\s+"), " ").trim()

    fun last(ctx: Context): JSONObject? {
        try {
            val f = File(Storage.data(ctx), "history.json")
            if (!f.exists()) return null
            val h = JSONObject(f.readText()); var best: JSONObject? = null
            h.keys().forEach { k -> val e = h.optJSONObject(k) ?: return@forEach; if (best == null || e.optLong("updated") > best!!.optLong("updated")) best = e }
            return best
        } catch (e: Exception) { return null }
    }

    fun clock(s: Long) = if (s >= 3600) "%d:%02d:%02d".format(s / 3600, s / 60 % 60, s % 60) else "%d:%02d".format(s / 60, s % 60)

    fun sub(e: JSONObject?): String {
        if (e == null) return "Open Astra Player"
        val t = e.optLong("time"); val d = e.optLong("dur")
        return if (d > 0) "${clock(t)} / ${clock(d)}  ·  ${maxOf(0, (d - t) / 60)} min left" else "Tap to resume"
    }

    /** Cover of the last watched video, centre-cropped to w x h with rounded corners. */
    fun cover(ctx: Context, w: Int, h: Int, radius: Float): Bitmap? {
        try {
            val f = File(Storage.data(ctx), "cover.jpg")
            if (!f.isFile) return null
            val src = BitmapFactory.decodeFile(f.absolutePath) ?: return null
            val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val c = Canvas(out)
            val sc = maxOf(w.toFloat() / src.width, h.toFloat() / src.height)
            val dw = src.width * sc; val dh = src.height * sc
            val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
            val rr = RectF(0f, 0f, w.toFloat(), h.toFloat())
            c.drawRoundRect(rr, radius, radius, p)
            p.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
            c.drawBitmap(src, null, RectF((w - dw) / 2, (h - dh) / 2, (w + dw) / 2, (h + dh) / 2), p)
            src.recycle()
            return out
        } catch (e: Throwable) { return null }
    }

    /** Seconds watched per day ("yyyy-MM-dd"), synced from the web UI. */
    fun watch(ctx: Context): JSONObject = try { JSONObject(File(Storage.data(ctx), "watch.json").readText()) } catch (e: Exception) { JSONObject() }

    fun dayKey(c: Calendar) = "%04d-%02d-%02d".format(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))

    fun hm(sec: Long): String { val h = sec / 3600; val m = sec / 60 % 60; return if (h > 0) "${h}h ${m}m" else if (sec >= 60) "${m}m" else "${sec}s" }

    fun refreshAll(ctx: Context) {
        for (c in listOf(ContinueWidget::class.java, HeroWidget::class.java, QuickWidget::class.java, StatsWidget::class.java)) {
            try {
                val m = AppWidgetManager.getInstance(ctx)
                val ids = m.getAppWidgetIds(ComponentName(ctx, c))
                if (ids.isEmpty()) continue
                val p = c.getDeclaredConstructor().newInstance() as BaseWidget
                for (id in ids) m.updateAppWidget(id, p.build(ctx))
            } catch (e: Throwable) { }
        }
    }

    /** Called often (every history save): at most one refresh every 15 s. */
    fun refreshSoon(ctx: Context) {
        val now = System.currentTimeMillis()
        if (now - lastRefresh < 15000) return
        lastRefresh = now
        refreshAll(ctx)
    }

    /** Make the cover file for the last watched video (runs on the caller's thread). */
    fun makeCover(ctx: Context, api: Api, rel: String) {
        try {
            val key = File(Storage.data(ctx), "cover.key")
            if (key.exists() && key.readText() == rel && File(Storage.data(ctx), "cover.jpg").isFile) return
            val b = api.thumb(rel) ?: return
            File(Storage.data(ctx), "cover.jpg").writeBytes(b)
            key.writeText(rel)
            lastRefresh = 0
            refreshAll(ctx)
        } catch (e: Throwable) { }
    }
}

abstract class BaseWidget : AppWidgetProvider() {
    abstract fun build(ctx: Context): RemoteViews
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) { for (id in ids) try { mgr.updateAppWidget(id, build(context)) } catch (e: Throwable) { } }
}

/** Compact "continue watching": small cover, title, progress. Tap to resume. */
class ContinueWidget : BaseWidget() {
    companion object { fun refresh(ctx: Context) = Wdg.refreshAll(ctx) }
    override fun build(ctx: Context): RemoteViews {
        val v = RemoteViews(ctx.packageName, R.layout.widget_continue)
        val e = Wdg.last(ctx); val d = ctx.resources.displayMetrics.density
        if (e != null) {
            v.setTextViewText(R.id.w_title, Wdg.nice(e.optString("name")))
            v.setProgressBar(R.id.w_bar, 100, e.optInt("percent"), false)
        }
        v.setTextViewText(R.id.w_sub, Wdg.sub(e))
        val cv = Wdg.cover(ctx, (112 * d).toInt(), (72 * d).toInt(), 12 * d)
        if (cv != null) v.setImageViewBitmap(R.id.w_cover, cv) else v.setImageViewResource(R.id.w_cover, R.drawable.widget_cover_empty)
        v.setOnClickPendingIntent(R.id.w_root, Wdg.go(ctx, 77, "resume"))
        return v
    }
}

/** Big banner: cover of the last watched video, title, progress and a Resume button. */
class HeroWidget : BaseWidget() {
    override fun build(ctx: Context): RemoteViews {
        val v = RemoteViews(ctx.packageName, R.layout.widget_hero)
        val e = Wdg.last(ctx); val d = ctx.resources.displayMetrics.density
        if (e != null) {
            v.setTextViewText(R.id.h_title, Wdg.nice(e.optString("name")))
            v.setProgressBar(R.id.h_bar, 100, e.optInt("percent"), false)
        }
        v.setTextViewText(R.id.h_sub, Wdg.sub(e))
        val cv = Wdg.cover(ctx, (360 * d).toInt().coerceAtMost(720), (190 * d).toInt().coerceAtMost(380), 22 * d)
        if (cv != null) v.setImageViewBitmap(R.id.h_cover, cv) else v.setImageViewResource(R.id.h_cover, R.drawable.widget_cover_empty)
        v.setOnClickPendingIntent(R.id.h_root, Wdg.go(ctx, 78, "resume"))
        v.setOnClickPendingIntent(R.id.h_btn, Wdg.go(ctx, 78, "resume"))
        return v
    }
}

/** Four round shortcuts: Resume, Files, Tasks, Home. */
class QuickWidget : BaseWidget() {
    override fun build(ctx: Context): RemoteViews {
        val v = RemoteViews(ctx.packageName, R.layout.widget_quick)
        v.setOnClickPendingIntent(R.id.q_resume, Wdg.go(ctx, 81, "resume"))
        v.setOnClickPendingIntent(R.id.q_files, Wdg.go(ctx, 82, "files"))
        v.setOnClickPendingIntent(R.id.q_tasks, Wdg.go(ctx, 83, "tasks"))
        v.setOnClickPendingIntent(R.id.q_home, Wdg.go(ctx, 84, "home"))
        return v
    }
}

/** Screen-time style card: today, streak and the last 7 days. */
class StatsWidget : BaseWidget() {
    override fun build(ctx: Context): RemoteViews {
        val v = RemoteViews(ctx.packageName, R.layout.widget_stats)
        val d = ctx.resources.displayMetrics.density
        val log = Wdg.watch(ctx)
        val cal = Calendar.getInstance()
        val vals = LongArray(7); val lab = CharArray(7)
        for (i in 6 downTo 0) {
            val c = Calendar.getInstance(); c.add(Calendar.DAY_OF_YEAR, -i)
            vals[6 - i] = log.optDouble(Wdg.dayKey(c), 0.0).toLong()
            lab[6 - i] = "SMTWTFS"[c.get(Calendar.DAY_OF_WEEK) - 1]
        }
        var streak = 0
        for (i in 0 until 400) {
            val c = Calendar.getInstance(); c.add(Calendar.DAY_OF_YEAR, -i)
            if (log.optDouble(Wdg.dayKey(c), 0.0) >= 60) streak++ else if (i == 0) continue else break
        }
        val week = vals.sum()
        v.setTextViewText(R.id.s_today, Wdg.hm(vals[6]))
        v.setTextViewText(R.id.s_streak, if (streak == 1) "1 day streak" else "$streak day streak")
        v.setTextViewText(R.id.s_week, "This week  " + Wdg.hm(week) + "   ·   avg " + Wdg.hm(week / 7) + "/day")
        // bars
        val w = (300 * d).toInt(); val h = (84 * d).toInt()
        val bm = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888); val c = Canvas(bm)
        val max = maxOf(vals.max(), 600L).toFloat()
        val bw = w / 7f; val label = 12 * d; val top = 4 * d
        val p = Paint(Paint.ANTI_ALIAS_FLAG); p.textAlign = Paint.Align.CENTER; p.textSize = 10 * d
        for (i in 0 until 7) {
            val bh = maxOf(4 * d, (h - label - top - 6 * d) * (vals[i] / max))
            val x0 = i * bw + bw * 0.22f; val x1 = (i + 1) * bw - bw * 0.22f; val y1 = h - label - 4 * d
            p.color = if (i == 6) Color.parseColor("#3B82F6") else Color.parseColor("#33FFFFFF")
            c.drawRoundRect(RectF(x0, y1 - bh, x1, y1), 5 * d, 5 * d, p)
            p.color = if (i == 6) Color.WHITE else Color.parseColor("#9AA6C0")
            c.drawText(lab[i].toString(), i * bw + bw / 2, h - 1 * d, p)
        }
        v.setImageViewBitmap(R.id.s_chart, bm)
        v.setOnClickPendingIntent(R.id.s_root, Wdg.go(ctx, 85, "stats"))
        return v
    }
}
