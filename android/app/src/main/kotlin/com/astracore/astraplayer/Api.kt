package com.astracore.astraplayer

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import androidx.media3.exoplayer.MediaExtractorCompat
import java.nio.ByteBuffer
import android.net.Uri
import android.os.Environment
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest

/** Answers the same /api/* calls the Node server does, so the web UI runs unchanged inside the app. */
class Api(private val ctx: Context) {
    private val dir: File = ctx.filesDir
    private val thumbDir = File(ctx.cacheDir, "thumbs").apply { mkdirs() }
    private val lock = Any()
    private var history = loadJson("history.json")
    private var profile = loadJson("profile.json")
    private var config = loadJson("config.json")
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
            val tmp = File(dir, "$name.tmp")
            tmp.writeText(o.toString())
            tmp.renameTo(File(dir, name))
        } catch (e: Exception) { }
    }

    fun root(): String {
        val saved = config.optString("mediaRoot", "")
        if (saved.isNotEmpty() && File(saved).isDirectory) return saved
        val base = Environment.getExternalStorageDirectory()
        for (n in listOf("anime", "Anime", "Movies", "Download")) {
            val f = File(base, n)
            if (f.isDirectory) return f.absolutePath
        }
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
                out.getOrPut(key) { mutableListOf() }.add(o)
            }
        }
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
            "/api/video/metadata" -> return metadata(uri.getQueryParameter("file") ?: "")
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
            "/api/tasks" -> return ok(JSONObject().put("tasks", JSONArray()))
            "/api/system/status" -> return ok(JSONObject())
        }
        return Pair(404, JSONObject().put("error", "Not available in the app yet").toString())
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
        return ok(JSONObject().put("ok", true).put("history", hn).put("settings", pn))
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
                ex.setDataSource(Uri.fromFile(f), 0)
                var an = 0
                for (i in 0 until ex.trackCount) {
                    val fmt = ex.getTrackFormat(i)
                    val mime = fmt.getString(MediaFormat.KEY_MIME) ?: continue
                    val lang = (if (fmt.containsKey(MediaFormat.KEY_LANGUAGE)) fmt.getString(MediaFormat.KEY_LANGUAGE) else null) ?: "und"
                    if (mime.startsWith("audio/")) {
                        audio.put(JSONObject().put("streamIndex", "0:a:$an").put("title", "Audio ${an + 1}" + (if (lang != "und") " • $lang" else ""))
                            .put("lang", lang).put("codec", audioName(mime)))
                        an++
                    } else if (subFormat(mime) != null) {
                        subs.put(JSONObject().put("streamIndex", i).put("title", "Subtitle ${subs.length() + 1}" + (if (lang != "und") " • $lang" else ""))
                            .put("lang", lang).put("codec", subFormat(mime)!!))
                    }
                }
            } finally { ex.release() }
        } catch (e: Exception) { }
        if (audio.length() == 0) audio.put(JSONObject().put("streamIndex", "0:a:0").put("title", "Default Audio").put("lang", "und").put("codec", "aac"))
        // is10BitHevc stays false: the app decodes natively, so the UI never asks for a server-side conversion.
        return ok(JSONObject().put("audioTracks", audio).put("subtitleTracks", subs).put("is10BitHevc", false)
            .put("duration", dur).put("chapters", JSONArray()))
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
        "text/vtt" -> "vtt"
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
            ex.setDataSource(Uri.fromFile(f), 0)
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
                    sb.append(text).append('\n')
                }
            }
            val out = JSONObject().put("fmt", kind).put("text", sb.toString()).toString()
            subCache[key] = out
            return Pair(200, out)
        } catch (e: Exception) {
            return Pair(500, "Subtitle extraction failed")
        } finally {
            try { ex.release() } catch (e: Exception) { }
        }
    }

    private fun explore(req: String): Pair<Int, String> {
        val d = if (req.isNotEmpty() && File(req).isDirectory) File(req) else File(root())
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
                        .put("type", if (ext in videoExts) "video" else "sub").put("relPath", rel))
                }
            }
        }
        return ok(JSONObject().put("current", d.absolutePath).put("parent", d.parent ?: d.absolutePath)
            .put("folders", folders).put("files", files))
    }
}
