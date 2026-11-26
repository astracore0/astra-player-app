package com.astracore.astraplayer

import android.app.ActivityManager
import android.content.Context
import android.os.Process
import android.os.SystemClock
import android.graphics.Bitmap
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import androidx.media3.inspector.MediaExtractorCompat
import java.nio.ByteBuffer
import android.net.Uri
import android.os.Environment
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest

/** Answers the same API calls the Node server does, so the web UI runs unchanged inside the app. */
class Api(private val ctx: Context) {
    private val dir: File = run { Storage.migrate(ctx); Storage.data(ctx) }
    private val thumbDir = Storage.thumbs(ctx)
    private val lock = Any()
    private var history = loadJson("history.json")
    private var profile = loadJson("profile.json")
    private var config = loadJson("config.json")
    private val ai = AiSubs.shared(ctx) { f -> resolve(f) }
    private var libCache: JSONObject? = null
    private var libAt = 0L

    private val videoExts = setOf("mp4", "mkv", "webm", "avi", "mov", "ts", "m4v", "3gp", "flv", "wmv", "mpg", "mpeg")
    private val subExts = setOf("srt", "vtt", "ass", "ssa")
    private val junk = listOf("whatsapp", "instagram", "telegram", "android", "cache", "facebook", "lost.dir", ".thumbnails")
    private val profileKeys = setOf("astra_prefs", "astra_saved_filters", "astra_video_prefs", "astra_user_settings")

    private fun loadJson(name: String): JSONObject =
        try { JSONObject(File(dir, name).readText()) } catch (e: Exception) { JSONObject() }

    private fun saveJson(name: String, o: JSONObject) {
        try {
            val tmp = File(dir, "$name.${System.nanoTime()}.tmp")
            tmp.writeText(o.toString())
            tmp.renameTo(File(dir, name))
        } catch (e: Exception) { }
    }

    fun root(): String {
        val saved = config.optString("mediaRoot", "")
        if (saved.isNotEmpty() && File(saved).isDirectory) return saved
        val base = Environment.getExternalStorageDirectory()   // default: the main storage, from its top folder
        return base.absolutePath
    }

    fun resolve(file: String): File? {
        if (file.isEmpty()) return null
        val f = if (file.startsWith("/")) File(file) else File(root(), file)
        return if (f.isFile) f else null
    }

    // ---------- library ----------
    private fun natCompare(a: String, b: String): Int {
        var i = 0
        var j = 0
        while (i < a.length && j < b.length) {
            if (a[i].isDigit() && b[j].isDigit()) {
                val si = i
                while (i < a.length && a[i].isDigit()) i++
                val sj = j
                while (j < b.length && b[j].isDigit()) j++
                val x = a.substring(si, i).trimStart('0')
                val y = b.substring(sj, j).trimStart('0')
                if (x.length != y.length) return x.length - y.length
                val c = x.compareTo(y)
                if (c != 0) return c
            } else {
                if (a[i] != b[j]) return a[i].compareTo(b[j])
                i++; j++
            }
        }
        return (a.length - i) - (b.length - j)
    }
    private val nat = Comparator<String> { a, b -> natCompare(a.lowercase(), b.lowercase()) }

    private fun scan(d: File, rel: String, depth: Int, out: MutableMap<String, MutableList<JSONObject>>) {
        if (depth > 12) return
        val items = d.listFiles() ?: return
        for (it in items) {
            val lower = it.name.lowercase()
            val r = if (rel.isEmpty()) it.name else "$rel/${it.name}"
            if (it.isDirectory) {
                if (junk.any { j -> lower == j || lower.startsWith(j) }) continue
                scan(it, r, depth + 1, out)
            } else if (it.isFile) {
                if (it.name.startsWith("._")) continue
                if (it.extension.lowercase() !in videoExts) continue
                val key = if (rel.isEmpty()) "Anime Root" else rel.split("/").joinToString(" / ")
                val o = JSONObject()
                o.put("name", it.name)
                o.put("relPath", r)
                o.put("fullPath", it.absolutePath)
                o.put("size", String.format("%.1f MB", it.length() / 1048576.0))
                o.put("mtime", it.lastModified())
                out.getOrPut(key) { mutableListOf() }.add(o)
            }
        }
    }

    /** Download/<AppName>-subtitles or Download/<AppName>-backup only; nothing else can be listed or deleted through the API. */
    private fun dlDir(folder: String): File? {
        if (!Regex("^[A-Za-z0-9._-]{1,60}-(subtitles|backup)$").matches(folder)) return null
        val d = File(android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS), folder)
        return if (d.isDirectory) d else null
    }

    private fun library(force: Boolean): JSONObject {
        val now = System.currentTimeMillis()
        val c = libCache
        if (!force && c != null && now - libAt < 30000) return c
        val map = HashMap<String, MutableList<JSONObject>>()
        scan(File(root()), "", 0, map)
        val lib = JSONObject()
        map.keys.sortedWith(nat).forEach { k ->
            val arr = JSONArray()
            map[k]!!.sortedWith { a, b -> natCompare(a.optString("name").lowercase(), b.optString("name").lowercase()) }.forEach { arr.put(it) }
            lib.put(k, arr)
        }
        val res = JSONObject()
        res.put("root", root())
        res.put("library", lib)
        libCache = res
        libAt = now
        return res
    }

    // ---------- thumbnails ----------
    fun thumb(file: String): ByteArray? {
        val f = resolve(file) ?: return null
        val key = MessageDigest.getInstance("SHA-1").digest("${f.absolutePath}|${f.length()}|${f.lastModified()}".toByteArray())
            .joinToString("") { b -> "%02x".format(b) }
        val cached = File(thumbDir, "$key.jpg")
        if (cached.isFile) return cached.readBytes()
        val mmr = MediaMetadataRetriever()
        try {
            mmr.setDataSource(f.absolutePath)
            val durMs = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            val atUs = minOf(durMs / 10, 60000L) * 1000L
            var bmp = mmr.getFrameAtTime(atUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC) ?: return null
            val w = 480
            if (bmp.width > w) bmp = Bitmap.createScaledBitmap(bmp, w, bmp.height * w / bmp.width, true)
            val bos = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 80, bos)
            val bytes = bos.toByteArray()
            try { cached.writeBytes(bytes) } catch (e: Exception) { }
            return bytes
        } catch (e: Exception) {
            return null
        } finally {
            try { mmr.release() } catch (e: Exception) { }
        }
    }

    private fun dirSize(d: File): Pair<Long, Int> {
        var b = 0L
        var n = 0
        d.listFiles()?.forEach { f -> if (f.isFile) { b += f.length(); n++ } }
        return Pair(b, n)
    }

    // ---------- router ----------
    fun handle(method: String, url: String, body: String): Pair<Int, String> {
        val uri = Uri.parse("https://x$url")
        val path = uri.path ?: ""
        val b = try { if (body.isNotEmpty()) JSONObject(body) else JSONObject() } catch (e: Exception) { JSONObject() }
        if (path.startsWith("/api/cast/")) return try { castRoute(path, b) } catch (e: Exception) { Pair(500, JSONObject().put("error", e.message ?: "error").toString()) }
        synchronized(lock) {
            try {
                return route(method, path, uri, b)
            } catch (e: Exception) {
                return Pair(500, JSONObject().put("error", e.message ?: "error").toString())
            }
        }
    }

    private fun ok(o: Any): Pair<Int, String> = Pair(200, o.toString())

    private fun route(method: String, path: String, uri: Uri, b: JSONObject): Pair<Int, String> {
        when (path) {
            "/api/whoami" -> return ok(JSONObject().put("guest", false))
            "/api/library" -> return ok(library(uri.getQueryParameter("refresh") == "1"))
            "/api/descriptions" -> return ok(JSONObject())
            "/api/system/capabilities" ->
                return ok(JSONObject().put("hwEncoder", JSONObject.NULL).put("hwDisabled", false)
                    .put("cores", Runtime.getRuntime().availableProcessors()).put("lowEnd", false))
            "/api/history" -> {
                if (method == "POST") return postHistory(b)
                return ok(history)
            }
            "/api/history/clear" -> { history = JSONObject(); saveJson("history.json", history); return ok(JSONObject().put("status", "cleared")) }
            "/api/profile" -> {
                if (method == "POST") {
                    val ch = b.optJSONObject("changes") ?: JSONObject()
                    var n = 0
                    ch.keys().forEach { k ->
                        val c = ch.optJSONObject(k)
                        val v = c?.optString("v", null)
                        if (k in profileKeys && v != null && v.length <= 512 * 1024) {
                            val cur = profile.optJSONObject(k)
                            if (cur == null || cur.optString("v") != v) {
                                profile.put(k, JSONObject().put("v", v).put("t", System.currentTimeMillis())); n++
                            }
                        }
                    }
                    if (n > 0) saveJson("profile.json", profile)
                    return ok(JSONObject().put("ok", true).put("updated", n).put("keys", profile))
                }
                return ok(JSONObject().put("keys", profile).put("now", System.currentTimeMillis()))
            }
            "/api/restore" -> return restore(b)
            "/api/backup/subs" -> return ok(exportSubs())
            "/api/import/history" -> return importHistory(b)
            "/api/video/metadata" -> return metadata(uri.getQueryParameter("file") ?: "")
            "/api/meta/online" -> return Artwork.find(ctx, uri.getQueryParameter("title") ?: "", uri.getQueryParameter("q") ?: "360p")
            "/api/subs/stream" -> return subsStream(uri.getQueryParameter("file") ?: "", uri.getQueryParameter("trackIndex") ?: "")
            "/api/subs/file" -> return subsFile(uri.getQueryParameter("path") ?: "")
            "/api/storage/explore" -> return explore(uri.getQueryParameter("dir") ?: "")
            "/api/settings/root" -> {
                val np = b.optString("newPath", "")
                if (np.isEmpty() || !File(np).isDirectory) return Pair(400, JSONObject().put("success", false).put("message", "Directory does not exist").toString())
                config.put("mediaRoot", File(np).absolutePath); saveJson("config.json", config); libCache = null
                return ok(JSONObject().put("success", true).put("root", root()).put("library", library(true).getJSONObject("library")))
            }
            "/api/cache/info" -> {
                val t = dirSize(thumbDir)
                return ok(JSONObject().put("thumbs", JSONObject().put("bytes", t.first).put("files", t.second))
                    .put("converted", JSONObject().put("bytes", 0).put("files", 0)).put("total", t.first))
            }
            "/api/cache/clear", "/api/thumbs/clear" -> {
                thumbDir.listFiles()?.forEach { f -> f.delete() }
                return ok(JSONObject().put("status", "cleared"))
            }
            "/api/storage/locations" -> {
                fun e(f: File) = JSONObject().put("path", f.absolutePath).put("bytes", Storage.size(f))
                return ok(JSONObject().put("base", Storage.base(ctx).absolutePath).put("data", e(Storage.data(ctx))).put("subtitles", e(Storage.subs(ctx)))
                    .put("models", e(Storage.models(ctx))).put("cache", e(thumbDir)))
            }
            "/api/downloads/list" -> {
                val d = dlDir(uri.getQueryParameter("folder") ?: "") ?: return ok(JSONObject().put("files", JSONArray()))
                val arr = JSONArray()
                (d.listFiles() ?: emptyArray()).filter { it.isFile }.sortedByDescending { it.lastModified() }.forEach { f ->
                    arr.put(JSONObject().put("name", f.name).put("bytes", f.length()).put("time", f.lastModified()))
                }
                return ok(JSONObject().put("path", "Download/" + d.name).put("files", arr))
            }
            "/api/downloads/get" -> {
                val d = dlDir(uri.getQueryParameter("folder") ?: "") ?: return Pair(404, "")
                val n = uri.getQueryParameter("name") ?: ""
                if (n.contains('/') || n.contains('\\') || !n.endsWith(".json")) return Pair(400, "")
                val f = File(d, n); if (!f.isFile || f.length() > 40_000_000) return Pair(404, "")
                return Pair(200, f.readText())
            }
            "/api/downloads/delete" -> {
                val d = dlDir(b.optString("folder")) ?: return Pair(400, JSONObject().put("error", "Bad folder").toString())
                val n = b.optString("name")
                val all = b.optBoolean("all", false)
                var cnt = 0
                if (all) (d.listFiles() ?: emptyArray()).forEach { if (it.isFile && it.delete()) cnt++ }
                else if (n.isNotEmpty() && !n.contains('/') && !n.contains('\\')) { val f = File(d, n); if (f.isFile && f.delete()) cnt++ }
                return ok(JSONObject().put("deleted", cnt))
            }
            "/api/system/status" -> return ok(systemStatus())
        }
        if (path.startsWith("/api/ai/") || path.startsWith("/api/tasks")) ai.handle(method, path, { k -> uri.getQueryParameter(k) }, b)?.let { return it }
        return Pair(404, JSONObject().put("error", "Not available in the app yet").toString())
    }

    private var lastCpuMs = Process.getElapsedCpuTime()
    private var lastWallMs = SystemClock.elapsedRealtime()
    private var lastCpuPct = 0.0

    private fun systemStatus(): JSONObject {
        val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        val pss = try { am.getProcessMemoryInfo(intArrayOf(Process.myPid()))[0].totalPss / 1024.0 } catch (e: Exception) { 0.0 }
        val cpu = Process.getElapsedCpuTime()
        val wall = SystemClock.elapsedRealtime()
        if (wall - lastWallMs >= 500) {
            lastCpuPct = ((cpu - lastCpuMs).toDouble() / (wall - lastWallMs)) * 100.0 / Runtime.getRuntime().availableProcessors()
            lastCpuMs = cpu; lastWallMs = wall
        }
        val total = mi.totalMem / 1048576.0
        return JSONObject().put("uptime", 0).put("ramUsedMB", String.format("%.1f", pss)).put("heapUsedMB", String.format("%.1f", pss))
            .put("totalSysMemMB", String.format("%.0f", total)).put("usedSysMemMB", String.format("%.0f", total - mi.availMem / 1048576.0))
            .put("cpuPercent", Math.round(lastCpuPct.coerceIn(0.0, 100.0)))
    }

    /** DLNA casting. Runs outside the API lock because scanning for TVs takes a few seconds. */
    private fun castRoute(path: String, b: JSONObject): Pair<Int, String> = when (path) {
        "/api/cast/devices" -> ok(JSONObject().put("devices", Dlna.discover(ctx)))
        "/api/cast/play" -> {
            val f = resolve(b.optString("file"))
            if (f == null) ok(JSONObject().put("ok", false).put("error", "Only videos on this phone can be cast"))
            else ok(Dlna.play(b.optInt("dev", 0), f, b.optString("title", f.name), b.optInt("time", 0)))
        }
        "/api/cast/ctl" -> ok(Dlna.ctl(b.optString("action"), b.optInt("pos", 0)))
        "/api/cast/status" -> ok(Dlna.status())
        else -> Pair(404, "")
    }

    private fun postHistory(b: JSONObject): Pair<Int, String> {
        val rel = b.optString("relPath", "")
        val name = b.optString("name", "")
        if (rel.isEmpty() && name.isEmpty()) return Pair(400, "Missing payload")
        val key = (if (rel.isNotEmpty()) rel else name).take(1024)
        val t = maxOf(0.0, b.optDouble("time", 0.0).let { if (it.isNaN()) 0.0 else it })
        val d = maxOf(0.0, b.optDouble("dur", 0.0).let { if (it.isNaN()) 0.0 else it })
        val pct = if (d > 0) minOf(100, maxOf(0, Math.floor(t / d * 100).toInt())) else 0
        history.put(key, JSONObject().put("name", (if (name.isNotEmpty()) name else File(key).name).take(512))
            .put("relPath", key).put("time", Math.floor(t).toLong()).put("dur", Math.floor(d).toLong())
            .put("percent", pct).put("updated", System.currentTimeMillis()))
        saveJson("history.json", history)
        return ok(JSONObject().put("ok", true))
    }

    private fun restore(b: JSONObject): Pair<Int, String> {
        var hn = 0
        var pn = 0
        val h = b.optJSONObject("history")
        if (h != null) {
            h.keys().forEach { k ->
                val e = h.optJSONObject(k) ?: return@forEach
                val key = e.optString("relPath", k).take(1024)
                val upd = e.optLong("updated", 0)
                val cur = history.optJSONObject(key)
                if (cur != null && cur.optLong("updated", 0) >= upd) return@forEach
                val t = maxOf(0.0, e.optDouble("time", 0.0))
                val d = maxOf(0.0, e.optDouble("dur", 0.0))
                history.put(key, JSONObject().put("name", e.optString("name", File(key).name).take(512)).put("relPath", key)
                    .put("time", Math.floor(t).toLong()).put("dur", Math.floor(d).toLong())
                    .put("percent", if (d > 0) minOf(100, Math.floor(t / d * 100).toInt()) else e.optInt("percent", 0).coerceIn(0, 100))
                    .put("updated", if (upd > 0) upd else System.currentTimeMillis()))
                hn++
            }
            saveJson("history.json", history)
        }
        val p = b.optJSONObject("profile")
        if (p != null) {
            p.keys().forEach { k ->
                val c = p.optJSONObject(k) ?: return@forEach
                val v = c.optString("v", null)
                if (k in profileKeys && v != null && v.length <= 512 * 1024) {
                    profile.put(k, JSONObject().put("v", v).put("t", System.currentTimeMillis())); pn++
                }
            }
            if (pn > 0) saveJson("profile.json", profile)
        }
        var sn = 0
        val sb = b.optJSONObject("subs")
        if (sb != null) {
            val root = Storage.subs(ctx).canonicalFile
            sb.keys().forEach { k ->
                if (!Regex("(?i).+\\.(vtt|srt|ass|ssa)$").matches(k) || k.contains("..") || k.startsWith("/")) return@forEach
                val f = File(root, k).canonicalFile
                if (!f.path.startsWith(root.path + File.separator) || f.exists()) return@forEach
                try { f.parentFile?.mkdirs(); f.writeText(sb.optString(k)); sn++ } catch (e: Exception) { }
            }
        }
        return ok(JSONObject().put("ok", true).put("history", hn).put("settings", pn).put("subs", sn))
    }

    /** Text subtitle files for the backup (small files only). */
    private fun exportSubs(): JSONObject {
        val out = JSONObject(); var total = 0L
        val root = Storage.subs(ctx)
        root.walkTopDown().filter { it.isFile && Regex("(?i).+\\.(vtt|srt|ass|ssa)$").matches(it.name) && !it.name.endsWith(".part") && it.length() in 1..2_000_000 }.forEach { f ->
            if (total + f.length() > 30_000_000) return@forEach
            try { out.put(f.relativeTo(root).path, f.readText()); total += f.length() } catch (e: Exception) { }
        }
        return out
    }

    private fun putHist(key: String, t: Double, d: Double, name: String? = null): Boolean {
        if (key.isBlank() || t <= 0.0) return false
        val cur = history.optJSONObject(key)
        if (cur != null && cur.optLong("time", 0) >= t.toLong()) return false
        history.put(key, JSONObject().put("name", (name ?: File(key).name).take(512)).put("relPath", key)
            .put("time", Math.floor(t).toLong()).put("dur", Math.floor(d).toLong())
            .put("percent", if (d > 0) minOf(100, Math.floor(t / d * 100).toInt()) else 0).put("updated", System.currentTimeMillis()))
        return true
    }

    /**
     * Brings watch positions from another player. Accepts an Astra backup, a JSON list, a CSV (path,position,duration),
     * or an SQLite database (for example a copy of MX Player's own database). Tables are matched by column names, so this is best effort.
     */
    private fun importHistory(b: JSONObject): Pair<Int, String> {
        val raw = try { android.util.Base64.decode(b.optString("data"), android.util.Base64.DEFAULT) } catch (e: Exception) { return Pair(400, JSONObject().put("error", "Bad file").toString()) }
        var imported = 0; var scanned = 0; var how = ""
        fun addPos(path: String, p: Double, d: Double) {
            scanned++
            val ms = d > 100000 || p > 100000
            val pos = if (ms) p / 1000.0 else p; val dur = if (ms) d / 1000.0 else d
            val clean = path.removePrefix("file://").let { try { Uri.decode(it) } catch (e: Exception) { it } }
            val rootPath = root().trimEnd('/') + "/"
            val key = if (clean.startsWith(rootPath)) clean.removePrefix(rootPath) else clean
            if (putHist(key, pos, dur, File(clean).name)) imported++
        }
        if (raw.size > 15 && String(raw, 0, 15, Charsets.ISO_8859_1) == "SQLite format 3") {
            how = "database"
            val tmp = File(ctx.cacheDir, "import_${System.currentTimeMillis()}.db")
            try {
                tmp.writeBytes(raw)
                val db = android.database.sqlite.SQLiteDatabase.openDatabase(tmp.path, null, android.database.sqlite.SQLiteDatabase.OPEN_READONLY)
                db.use {
                    val tables = ArrayList<String>()
                    it.rawQuery("SELECT name FROM sqlite_master WHERE type='table'", null).use { c -> while (c.moveToNext()) tables.add(c.getString(0)) }
                    val pathCols = listOf("path", "_data", "uri", "filepath", "file_path", "data", "filename", "file_name", "name", "title")
                    val posCols = listOf("position", "last_position", "last_pos", "lastpos", "resume", "resume_position", "last_played_position", "playback_position", "played_position", "progress")
                    val durCols = listOf("duration", "length", "dur", "total")
                    for (t in tables) {
                        val cols = ArrayList<String>()
                        try { it.rawQuery("PRAGMA table_info(\"$t\")", null).use { c -> while (c.moveToNext()) cols.add(c.getString(1)) } } catch (e: Exception) { continue }
                        val low = cols.map { c -> c.lowercase() }
                        val pc = pathCols.firstOrNull { c -> c in low }?.let { c -> cols[low.indexOf(c)] } ?: continue
                        val oc = posCols.firstOrNull { c -> c in low }?.let { c -> cols[low.indexOf(c)] } ?: continue
                        val dc = durCols.firstOrNull { c -> c in low }?.let { c -> cols[low.indexOf(c)] }
                        try {
                            it.rawQuery("SELECT \"$pc\", \"$oc\"" + (if (dc != null) ", \"$dc\"" else "") + " FROM \"$t\"", null).use { c ->
                                while (c.moveToNext()) { val p = c.getString(0) ?: continue; val pos = c.getDouble(1); val d = if (dc != null) c.getDouble(2) else 0.0; if (pos > 0) addPos(p, pos, d) }
                            }
                        } catch (e: Exception) { }
                    }
                }
            } catch (e: Exception) { return Pair(200, JSONObject().put("ok", false).put("error", "Could not read that database").toString()) }
            finally { tmp.delete() }
        } else {
            val text = String(raw, Charsets.UTF_8).trim()
            if (text.startsWith("{") || text.startsWith("[")) {
                how = "json"
                try {
                    if (text.startsWith("{")) {
                        val o = JSONObject(text)
                        if (o.has("history")) { val r = restore(o); val j = JSONObject(r.second); return Pair(200, JSONObject().put("ok", true).put("how", "backup").put("imported", j.optInt("history")).put("scanned", j.optInt("history")).toString()) }
                    }
                    val arr = if (text.startsWith("[")) JSONArray(text) else JSONObject(text).optJSONArray("items") ?: JSONArray()
                    for (i in 0 until arr.length()) {
                        val e = arr.optJSONObject(i) ?: continue
                        val p = e.optString("path", e.optString("uri", e.optString("file", ""))); if (p.isEmpty()) continue
                        addPos(p, e.optDouble("position", e.optDouble("time", 0.0)), e.optDouble("duration", e.optDouble("dur", 0.0)))
                    }
                } catch (e: Exception) { return Pair(200, JSONObject().put("ok", false).put("error", "Could not read that JSON").toString()) }
            } else {
                how = "csv"
                text.lines().forEach { ln ->
                    val p = ln.split(',', ';', '\t'); if (p.size < 2) return@forEach
                    val pos = p[1].trim().toDoubleOrNull() ?: return@forEach
                    addPos(p[0].trim().trim('"'), pos, p.getOrNull(2)?.trim()?.toDoubleOrNull() ?: 0.0)
                }
            }
        }
        if (imported > 0) saveJson("history.json", history)
        return ok(JSONObject().put("ok", true).put("how", how).put("imported", imported).put("scanned", scanned))
    }

    private fun metadata(file: String): Pair<Int, String> {
        val f = resolve(file) ?: return Pair(404, JSONObject().put("error", "File not found").toString())
        var dur = 0.0
        val mmr = MediaMetadataRetriever()
        try {
            mmr.setDataSource(f.absolutePath)
            dur = (mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L) / 1000.0
        } catch (e: Exception) { } finally { try { mmr.release() } catch (e: Exception) { } }
        val audio = JSONArray()
        val subs = JSONArray()
        try {
            val ex = MediaExtractorCompat(ctx)
            try {
                ex.setDataSource(f.absolutePath)
                val named = TrackNames.read(f)
                var nAudio = 0; var nText = 0
                for (i in 0 until ex.trackCount) { val m = ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: continue; if (m.startsWith("audio/")) nAudio++ else if (isTextMime(m)) nText++ }
                val namedAudio = named.filter { it.type == 2 }.takeIf { it.size == nAudio }
                val namedText = named.filter { it.type == 17 }.takeIf { it.size == nText }
                var an = 0
                for (i in 0 until ex.trackCount) {
                    val fmt = ex.getTrackFormat(i)
                    val mime = fmt.getString(MediaFormat.KEY_MIME) ?: continue
                    val lang = (if (fmt.containsKey(MediaFormat.KEY_LANGUAGE)) fmt.getString(MediaFormat.KEY_LANGUAGE) else null) ?: "und"
                    if (mime.startsWith("audio/")) {
                        audio.put(JSONObject().put("streamIndex", "0:a:$an").put("title", TrackNames.title(namedAudio?.getOrNull(an), "Audio ${an + 1}" + (TrackNames.language(lang).let { if (it.isNotEmpty()) " • $it" else "" })))
                            .put("lang", lang).put("codec", audioName(mime)))
                        an++
                    } else if (isTextMime(mime)) {
                        subs.put(JSONObject().put("streamIndex", i).put("title", TrackNames.title(namedText?.getOrNull(subs.length()), "Subtitle ${subs.length() + 1}" + (TrackNames.language(lang).let { if (it.isNotEmpty()) " • $it" else "" })))
                            .put("lang", lang).put("codec", subFormat(mime) ?: "srt"))
                    }
                }
            } finally { ex.release() }
        } catch (e: Exception) { }
        if (audio.length() == 0) audio.put(JSONObject().put("streamIndex", "0:a:0").put("title", "Default Audio").put("lang", "und").put("codec", "aac"))
        // is10BitHevc stays false: the app decodes natively, so the UI never asks for a server-side conversion.
        return ok(JSONObject().put("audioTracks", audio).put("subtitleTracks", subs).put("is10BitHevc", false)
            .put("duration", dur).put("chapters", Chapters.read(f, dur)))
    }

    @Volatile var currentFile: File? = null

    private fun isTextMime(m: String): Boolean = m.startsWith("text/") || m.startsWith("application/x-subrip") || m.contains("x-media3-cues") ||
        m.contains("ttml") || m.contains("pgs") || m.contains("vobsub") || m.contains("dvb") || m.contains("cea-")

    /** Number of text tracks before this extractor track = which native text group to switch on. */
    fun textOrdinal(extractorIndex: Int): Int {
        val f = currentFile ?: return -1
        val ex = MediaExtractorCompat(ctx)
        return try {
            ex.setDataSource(f.absolutePath)
            var n = 0
            for (i in 0 until minOf(extractorIndex, ex.trackCount)) if (isTextMime(ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: "")) n++
            n
        } catch (e: Exception) { -1 } finally { ex.release() }
    }

    private fun audioName(mime: String): String = when {
        mime.contains("mp4a") -> "aac"
        mime.contains("eac3") -> "eac3"
        mime.contains("ac3") -> "ac3"
        mime.contains("dts") -> "dts"
        mime.contains("opus") -> "opus"
        mime.contains("vorbis") -> "vorbis"
        mime.contains("flac") -> "flac"
        else -> mime.substringAfter("audio/").substringAfter("-")
    }

    private fun subFormat(mime: String): String? = when (mime) {
        "application/x-subrip" -> "srt"
        "text/x-ssa" -> "ass"
        "application/x-quicktime-tx3g" -> "tx3g"
        else -> null
    }

    // ---------- subtitles: raw text goes to the page, which converts it with the same code the server uses ----------
    private val subCache = HashMap<String, String>()

    private fun subsJson(fmt: String, text: String) = Pair(200, JSONObject().put("fmt", fmt).put("text", text).toString())

    private fun subsFile(path: String): Pair<Int, String> {
        val f = File(path)
        if (!f.isFile) return Pair(404, "Not found")
        val ext = f.extension.lowercase()
        val fmt = when (ext) { "srt" -> "srt"; "ass", "ssa" -> "ass"; "vtt" -> "vtt"; else -> return Pair(400, "Unsupported") }
        return subsJson(fmt, f.readText())
    }

    private fun tc(us: Long, sep: Char): String {
        val ms = us / 1000
        return String.format("%02d:%02d:%02d%c%03d", ms / 3600000, ms / 60000 % 60, ms / 1000 % 60, sep, ms % 1000)
    }
    private fun parseTc(s: String): Long {
        val m = Regex("(\\d+):(\\d+):(\\d+)[.,:](\\d+)").find(s) ?: return 0
        val frac = m.groupValues[4]
        val ms = if (frac.length == 2) frac.toLong() * 10 else frac.toLong()
        return ((m.groupValues[1].toLong() * 60 + m.groupValues[2].toLong()) * 60 + m.groupValues[3].toLong()) * 1000 + ms
    }
    private fun assTc(us: Long): String {
        val cs = us / 10000
        return String.format("%d:%02d:%02d.%02d", cs / 360000, cs / 6000 % 60, cs / 100 % 60, cs % 100)
    }

    private fun subsStream(file: String, track: String): Pair<Int, String> {
        val f = resolve(file) ?: return Pair(404, "File not found")
        val idx = track.toIntOrNull() ?: return Pair(400, "Bad track")
        val key = "${f.absolutePath}|${f.length()}|$idx"
        val hit = subCache[key]
        if (hit != null) return Pair(200, hit)
        val ex = MediaExtractorCompat(ctx)
        try {
            ex.setDataSource(f.absolutePath)
            val fmt = ex.getTrackFormat(idx)
            val mime = fmt.getString(MediaFormat.KEY_MIME) ?: ""
            val kind = subFormat(mime) ?: return Pair(415, "Unsupported subtitle format")
            ex.selectTrack(idx)
            val buf = ByteBuffer.allocate(1 shl 16)
            val sb = StringBuilder()
            var header = ""
            if (kind == "ass") {
                // csd-1 holds the script header (styles); csd-0 is the column layout Media3 uses internally.
                for (name in listOf("csd-1", "csd-0")) {
                    if (fmt.containsKey(name)) {
                        val bb = fmt.getByteBuffer(name)!!
                        val arr = ByteArray(bb.remaining()); bb.duplicate().get(arr)
                        val t = String(arr, Charsets.UTF_8)
                        if (t.contains("[Script Info]") || t.contains("[V4")) { header = t; break }
                    }
                }
                val ev = header.indexOf("[Events]")
                if (ev >= 0) header = header.substring(0, ev)
                if (header.isBlank()) header = "[Script Info]\nScriptType: v4.00+\nPlayResX: 384\nPlayResY: 288\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1\n\n"
                sb.append(header.trimEnd()).append("\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
            }
            var n = 0
            var pendText: String? = null
            var pendStart = 0L
            while (true) {
                buf.clear()
                val size = ex.readSampleData(buf, 0)
                if (size < 0) break
                val arr = ByteArray(size)
                buf.position(0); buf.get(arr, 0, size)
                val start = ex.sampleTime
                ex.advance()
                val text = String(arr, Charsets.UTF_8)
                if (kind == "srt") {
                    // Media3 hands SubRip blocks over as "1\n<start> --> <end>\n<text>" with the end time relative to the block start.
                    val nl = text.indexOf('\n', text.indexOf("-->"))
                    if (nl < 0) continue
                    val dur = parseTc(text.substring(text.indexOf("-->") + 3, nl))
                    val body = text.substring(nl + 1).trim()
                    if (body.isEmpty()) continue
                    n++
                    sb.append(n).append('\n').append(tc(start, ',')).append(" --> ").append(tc(start + dur, ',')).append('\n').append(body).append("\n\n")
                } else if (kind == "ass") {
                    // "Dialogue: <start>,<end>,ReadOrder,Layer,Style,Name,MarginL,MarginR,MarginV,Effect,Text"
                    val body = text.removePrefix("Dialogue:").trimStart()
                    val p = body.split(",", limit = 11)
                    if (p.size < 11) continue
                    val dur = parseTc(p[1])
                    sb.append("Dialogue: ").append(p[3]).append(',').append(assTc(start)).append(',').append(assTc(start + dur)).append(',')
                        .append(p[4]).append(',').append(p[5]).append(',').append(p[6]).append(',').append(p[7]).append(',').append(p[8]).append(',')
                        .append(p[9]).append(',').append(p[10].trimEnd()).append('\n')
                    n++
                } else {
                    // MP4 "mov_text": 2-byte length + text. A cue ends where the next sample starts (an empty sample clears it).
                    var txt = ""
                    if (size >= 2) {
                        val len = ((arr[0].toInt() and 0xFF) shl 8) or (arr[1].toInt() and 0xFF)
                        txt = String(arr, 2, minOf(len, size - 2), Charsets.UTF_8).trim()
                    }
                    if (pendText != null) {
                        n++
                        sb.append(n).append('\n').append(tc(pendStart, ',')).append(" --> ").append(tc(maxOf(start, pendStart + 500000), ',')).append('\n').append(pendText).append("\n\n")
                        pendText = null
                    }
                    if (txt.isNotEmpty()) { pendText = txt; pendStart = start }
                }
            }
            if (kind == "tx3g" && pendText != null) {
                n++
                sb.append(n).append('\n').append(tc(pendStart, ',')).append(" --> ").append(tc(pendStart + 3000000, ',')).append('\n').append(pendText).append("\n\n")
            }
            val out = JSONObject().put("fmt", if (kind == "tx3g") "srt" else kind).put("text", sb.toString()).toString()
            subCache[key] = out
            return Pair(200, out)
        } catch (e: Exception) {
            return Pair(500, "extraction failed: " + (e.message ?: e.javaClass.simpleName))
        } finally {
            try { ex.release() } catch (e: Exception) { }
        }
    }

    private fun explore(req: String): Pair<Int, String> {
        val d = if (req.isNotEmpty() && File(req).isDirectory) File(req) else Environment.getExternalStorageDirectory()
        val folders = JSONArray()
        val files = JSONArray()
        val items = (d.listFiles() ?: emptyArray()).sortedWith { a, b -> natCompare(a.name.lowercase(), b.name.lowercase()) }
        for (it in items) {
            if (it.isDirectory) folders.put(JSONObject().put("name", it.name).put("fullPath", it.absolutePath))
            else if (it.isFile) {
                val ext = it.extension.lowercase()
                if (ext in videoExts || ext in subExts) {
                    val rel = try { it.relativeTo(File(root())).path } catch (e: Exception) { it.absolutePath }
                    files.put(JSONObject().put("name", it.name).put("fullPath", it.absolutePath)
                        .put("type", if (ext in videoExts) "video" else "sub").put("relPath", rel)
                        .put("size", String.format("%.1f MB", it.length() / 1048576.0)).put("mtime", it.lastModified()))
                }
            }
        }
        return ok(JSONObject().put("current", d.absolutePath).put("parent", d.parent ?: d.absolutePath)
            .put("folders", folders).put("files", files))
    }
}
