package com.astracore.astraplayer

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Recycle bin. A deleted video is moved (not erased) to Android/data/<app>/files/trash together with its subtitle files.
 * It stays there for [KEEP_DAYS] days and can be restored; after that it is deleted for good.
 */
object Trash {
    const val KEEP_DAYS = 30
    private const val DAY = 86_400_000L
    private val sidecarExts = setOf("srt", "ass", "ssa", "vtt", "sub", "idx")

    fun dir(ctx: Context): File = File(Storage.base(ctx), "trash").also { it.mkdirs() }
    private fun indexFile(ctx: Context) = File(dir(ctx), "index.json")
    private fun index(ctx: Context): JSONObject = try { JSONObject(indexFile(ctx).readText()) } catch (e: Exception) { JSONObject() }
    private fun save(ctx: Context, o: JSONObject) { try { indexFile(ctx).writeText(o.toString()) } catch (e: Exception) { } }

    /** Rename when possible (instant, same storage); otherwise copy then delete. */
    private fun mv(a: File, b: File): Boolean {
        if (a.renameTo(b)) return true
        return try {
            a.copyTo(b, overwrite = false)
            if (b.length() == a.length()) { a.delete(); true } else { b.delete(); false }
        } catch (e: Exception) { b.delete(); false }
    }

    @Synchronized fun move(ctx: Context, f: File): JSONObject? {
        val id = java.lang.Long.toString(System.currentTimeMillis(), 36) + (100..999).random()
        val dest = File(dir(ctx), id + "_" + f.name)
        val size = f.length()
        if (!mv(f, dest)) return null
        val side = JSONArray()
        val stem = f.nameWithoutExtension
        f.parentFile?.listFiles()?.forEach { s ->
            if (s.isFile && s != f && s.extension.lowercase() in sidecarExts && (s.nameWithoutExtension == stem || s.nameWithoutExtension.startsWith("$stem."))) {
                val d = File(dir(ctx), id + "_s" + side.length() + "_" + s.name)
                if (mv(s, d)) side.put(JSONObject().put("orig", s.absolutePath).put("stored", d.name))
            }
        }
        val e = JSONObject().put("id", id).put("name", f.name).put("orig", f.absolutePath).put("stored", dest.name)
            .put("size", size).put("deletedAt", System.currentTimeMillis()).put("side", side)
        val idx = index(ctx); idx.put(id, e); save(ctx, idx)
        return e
    }

    /** Puts the video (and its subtitles) back where it was. Returns the new path, or null when it could not. */
    @Synchronized fun restore(ctx: Context, id: String): String? {
        val idx = index(ctx)
        val e = idx.optJSONObject(id) ?: return null
        var target = File(e.optString("orig"))
        target.parentFile?.mkdirs()
        if (target.exists()) target = File(target.parentFile, target.nameWithoutExtension + " (restored)." + target.extension)
        if (!mv(File(dir(ctx), e.optString("stored")), target)) return null
        val side = e.optJSONArray("side")
        if (side != null) for (i in 0 until side.length()) {
            val s = side.optJSONObject(i) ?: continue
            val t = File(s.optString("orig"))
            if (!t.exists()) mv(File(dir(ctx), s.optString("stored")), t) else File(dir(ctx), s.optString("stored")).delete()
        }
        idx.remove(id); save(ctx, idx)
        return target.absolutePath
    }

    private fun erase(ctx: Context, e: JSONObject) {
        File(dir(ctx), e.optString("stored")).delete()
        val side = e.optJSONArray("side")
        if (side != null) for (i in 0 until side.length()) File(dir(ctx), side.optJSONObject(i)?.optString("stored") ?: "").delete()
    }

    @Synchronized fun delete(ctx: Context, id: String): Boolean {
        val idx = index(ctx)
        val e = idx.optJSONObject(id) ?: return false
        erase(ctx, e); idx.remove(id); save(ctx, idx)
        return true
    }

    @Synchronized fun empty(ctx: Context): Int {
        val idx = index(ctx); var n = 0
        idx.keys().asSequence().toList().forEach { k -> idx.optJSONObject(k)?.let { erase(ctx, it); n++ } }
        save(ctx, JSONObject())
        return n
    }

    /** Removes everything that has been in the bin longer than KEEP_DAYS. Runs when the app starts. */
    @Synchronized fun purge(ctx: Context): Int {
        val idx = index(ctx); val now = System.currentTimeMillis(); var n = 0
        idx.keys().asSequence().toList().forEach { k ->
            val e = idx.optJSONObject(k) ?: return@forEach
            if (now - e.optLong("deletedAt") > KEEP_DAYS * DAY || !File(dir(ctx), e.optString("stored")).exists()) { erase(ctx, e); idx.remove(k); n++ }
        }
        if (n > 0) save(ctx, idx)
        return n
    }

    @Synchronized fun list(ctx: Context): JSONObject {
        val idx = index(ctx); val now = System.currentTimeMillis()
        val items = ArrayList<JSONObject>(); var total = 0L
        idx.keys().forEach { k ->
            val e = idx.optJSONObject(k) ?: return@forEach
            val left = ((e.optLong("deletedAt") + KEEP_DAYS * DAY - now + DAY - 1) / DAY).toInt().coerceIn(0, KEEP_DAYS)
            total += e.optLong("size")
            items.add(JSONObject().put("id", k).put("name", e.optString("name")).put("orig", e.optString("orig")).put("size", e.optLong("size"))
                .put("deletedAt", e.optLong("deletedAt")).put("daysLeft", left))
        }
        items.sortByDescending { it.optLong("deletedAt") }
        val arr = JSONArray(); items.forEach { arr.put(it) }
        return JSONObject().put("items", arr).put("bytes", total).put("keepDays", KEEP_DAYS)
    }
}
