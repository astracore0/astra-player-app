package com.astracore.astraplayer

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteOrder
import java.security.MessageDigest
import org.vosk.Model

/**
 * Online AI subtitles: the audio is decoded on the phone, cut into 10-minute 16 kHz mono WAV pieces
 * and sent to an OpenAI-compatible speech-to-text API (Groq, OpenAI ...). Result = WebVTT.
 */
class AiSubs private constructor(private val ctx: Context, resolveInit: (String) -> File?) {
    @Volatile var resolve: (String) -> File? = resolveInit
    companion object {
        @Volatile private var inst: AiSubs? = null
        /** One AiSubs per process: jobs keep running when the screen is closed and the activity is recreated. */
        fun shared(c: Context, r: (String) -> File?): AiSubs {
            val i = inst ?: synchronized(this) { inst ?: AiSubs(c.applicationContext, r).also { inst = it } }
            i.resolve = r
            return i
        }
        fun liveCount(): Int = inst?.liveJobs() ?: 0
        fun textNow(): String = inst?.liveText() ?: ""
    }
    fun liveJobs(): Int = synchronized(jobs) { jobs.values.count { live(it) } }
    fun liveText(): String = synchronized(jobs) { jobs.values.filter { live(it) }.joinToString(" · ") { niceName(it.rel) + " " + it.pct + "%" } }
    private val dir = Storage.subs(ctx)
    private val asr = OfflineAsr(ctx)
    private val prefs = ctx.getSharedPreferences("astra_ai", Context.MODE_PRIVATE)
    private val index: JSONObject = try { JSONObject(File(dir, "index.json").readText()) } catch (e: Exception) { JSONObject() }

    private class Job(val key: String, val file: File, val rel: String) {
        @Volatile var state = "queued"
        @Volatile var pct = 0
        @Volatile var msg = "Waiting"
        @Volatile var cancelled = false
        @Volatile var pauseReq = false
        @Volatile var engine = ""      // "" = Vosk, or a Whisper model key
        @Volatile var fb = ""          // backup model if this one fails: "", "vosk", "online" or a Whisper key
        @Volatile var wctx = 0L
        @Volatile var doneChunks = 0; @Volatile var lastEnd = 0.0; @Volatile var firstUs = -1L; @Volatile var chunkSec = 0   // where to continue after a pause or a restart
        @Volatile var endedAt = 0L
        var track = "0:a:0"; var lang = "auto"; var translate = false; var online = false
        @Volatile var startedAt = System.currentTimeMillis()
    }
    private val jobs = HashMap<String, Job>()
    private val jobsFile = File(Storage.base(ctx), "jobs.json")
    private var lastSaved = ""

    /** Task list survives the app being closed or killed: unfinished jobs come back as "paused" so they can be resumed. */
    private fun loadJobs() {
        try {
            if (!jobsFile.exists()) return
            val a = JSONArray(jobsFile.readText())
            synchronized(jobs) {
                for (i in 0 until a.length()) {
                    val o = a.getJSONObject(i)
                    val rel = o.optString("rel"); val k = o.optString("key")
                    val f = (try { resolve(rel) } catch (e: Exception) { null }) ?: File(rel)
                    val j = Job(k, f, rel)
                    j.track = o.optString("track", "0:a:0"); j.lang = o.optString("lang", "auto"); j.translate = o.optBoolean("tr"); j.online = o.optBoolean("online"); j.engine = o.optString("en", "")
                    j.startedAt = o.optLong("at", System.currentTimeMillis()); j.endedAt = o.optLong("end", 0)
                    j.pct = o.optInt("pct", 0)
                    j.doneChunks = o.optInt("dc", 0); j.lastEnd = o.optDouble("le", 0.0); j.firstUs = o.optLong("fu", -1L); j.chunkSec = o.optInt("cs", 0)
                    val st = o.optString("state", "done")
                    if (st == "queued" || st == "extracting" || st == "transcribing") { j.state = "paused"; j.msg = "Stopped when the app closed. Resume continues where it left off" }
                    else { j.state = st; j.msg = o.optString("msg", "") }
                    jobs[k] = j
                }
            }
        } catch (e: Exception) {}
    }

    private fun saveJobs() {
        try {
            val a = JSONArray()
            synchronized(jobs) {
                for (j in jobs.values) a.put(JSONObject().put("key", j.key).put("rel", j.rel).put("track", j.track).put("lang", j.lang)
                    .put("tr", j.translate).put("en", j.engine).put("online", j.online).put("at", j.startedAt).put("end", j.endedAt).put("pct", j.pct)
                    .put("state", j.state).put("msg", j.msg).put("dc", j.doneChunks).put("le", j.lastEnd).put("fu", j.firstUs).put("cs", j.chunkSec))
            }
            val t = a.toString()
            if (t != lastSaved) { val tmp = File(jobsFile.path + ".tmp"); tmp.writeText(t); tmp.renameTo(jobsFile); lastSaved = t }
        } catch (e: Exception) {}
    }

    init {
        loadJobs()
        Thread { while (true) { try { Thread.sleep(2500) } catch (e: Exception) {}; saveJobs() } }.also { it.isDaemon = true }.start()
    }

    // ---- settings ----
    private fun base() = prefs.getString("base", "https://api.groq.com/openai/v1")!!.trimEnd('/')
    private fun model() = prefs.getString("model", "all")!!
    /** Models tried best first when the setting is "all". A model the service refuses (not found / no access) is skipped for the rest of the run. */
    private fun modelOrder(): List<String> {
        val m = model()
        if (m != "all") return listOf(m)
        return if (base().contains("groq")) listOf("whisper-large-v3", "whisper-large-v3-turbo")
        else if (base().contains("openai.com")) listOf("whisper-1")
        else listOf("whisper-large-v3", "whisper-large-v3-turbo", "whisper-1")
    }
    private val badModels = java.util.Collections.synchronizedSet(HashSet<String>())

    /** Asks the service for its model list with the key: tells whether the key works. */
    private fun checkKey(k: String, bs: String): Pair<Boolean?, String> {
        return try {
            val c = URL(bs.trimEnd('/') + "/models").openConnection() as HttpURLConnection
            c.connectTimeout = 10000; c.readTimeout = 10000
            c.setRequestProperty("Authorization", "Bearer $k")
            val code = c.responseCode
            when {
                code in 200..299 -> Pair(true, "Key is valid")
                code == 401 || code == 403 -> Pair(false, "Key was refused ($code). Check that it is copied fully")
                else -> Pair(null, "Could not check the key (HTTP $code). Saved anyway")
            }
        } catch (e: Exception) { Pair(null, "No internet, could not check the key. Saved anyway") }
    }
    private fun key() = prefs.getString("key", "")!!
    private fun onlineJson(): JSONObject {
        val k = key()
        return JSONObject().put("configured", k.isNotEmpty()).put("base", base()).put("model", model())
            .put("hint", if (k.isNotEmpty()) "••••" + k.takeLast(4) else "")
    }

    fun online(method: String, b: JSONObject): Pair<Int, String> {
        if (method == "POST") {
            val e = prefs.edit()
            var check: Pair<Boolean?, String>? = null
            val bs = b.optString("base", "").trim()
            if (bs.isNotEmpty() && !bs.startsWith("https://")) return Pair(400, JSONObject().put("error", "The address must start with https://").toString())
            if (b.optBoolean("clear", false)) e.putString("key", "")
            else {
                val k = b.optString("key", "").trim()
                if (k.isNotEmpty()) {
                    if (!Regex("^[\\x21-\\x7e]{8,300}$").matches(k)) return Pair(400, JSONObject().put("error", "That does not look like an API key").toString())
                    check = checkKey(k, if (bs.isNotEmpty()) bs else base())
                    if (check.first == false) return Pair(400, JSONObject().put("error", check.second).toString())
                    e.putString("key", k)
                } else if (b.optBoolean("test", false) && key().isNotEmpty()) check = checkKey(key(), if (bs.isNotEmpty()) bs else base())
            }
            if (bs.isNotEmpty()) e.putString("base", bs.trimEnd('/'))
            val m = b.optString("model", "").trim()
            if (m.length in 2..80) e.putString("model", m)
            e.apply(); badModels.clear()
            val o = onlineJson()
            if (check != null) o.put("valid", check.first ?: JSONObject.NULL).put("checkMsg", check.second)
            return Pair(200, o.toString())
        }
        return Pair(200, onlineJson().toString())
    }

    fun capabilities(): JSONObject {
        val on = key().isNotEmpty()
        return JSONObject().put("online", on).put("whisper", WhisperEngine.available).put("available", true).put("local", true).put("bin", true)
            .put("vad", true).put("models", JSONArray().put("vosk-small")).put("queued", 0)
    }

    // ---- keys / files ----
    private fun keyFor(f: File, track: String, lang: String, tr: Boolean, online: Boolean, engine: String = ""): String {
        val s = "${f.absolutePath}|${f.length()}|${f.lastModified()}|$track|$lang|${if (tr) 1 else 0}|${if (online) model() else engine.ifEmpty { "vosk" }}|app2"
        return MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
    }
    private fun vttFile(k: String) = File(dir, "$k.vtt")
    private fun partFile(k: String) = File(dir, "$k.part")
    private fun saveIndex() { try { File(dir, "index.json").writeText(index.toString()) } catch (e: Exception) { } }

    private fun pub(j: Job): JSONObject = JSONObject().put("key", j.key).put("state", j.state).put("pct", j.pct).put("msg", j.msg)
        .put("elapsed", (System.currentTimeMillis() - j.startedAt) / 1000)

    private fun niceName(rel: String): String =
        File(rel).nameWithoutExtension.replace(Regex("[\\\\/:*?\"<>|]+"), " ").replace(Regex("\\s+"), " ").trim()

    // ---- offline speech models (download / delete on demand) ----
    private class MJob { @Volatile var state = "downloading"; @Volatile var pct = 0; @Volatile var msg = ""; @Volatile var cancel = false }
    private val mjobs = HashMap<String, MJob>()

    fun models(): JSONArray {
        val arr = JSONArray()
        for (k in OfflineAsr.MODELS.keys + OfflineAsr.WHISPER.keys) {
            val j = synchronized(mjobs) { mjobs[k] }
            val inst = asr.installed(k)
            val w = OfflineAsr.isWhisper(k)
            val o = JSONObject().put("key", k).put("name", if (w) OfflineAsr.WHISPER[k] else OfflineAsr.MODELS[k]).put("sizeMB", if (w) OfflineAsr.WHISPER_MB[k] ?: 75 else OfflineAsr.SIZE_MB[k] ?: 40).put("installed", inst).put("kind", if (w) "whisper" else "vosk")
            if (inst) o.put("bytes", Storage.size(asr.dirOf(k)))
            if (j != null && j.state == "downloading") o.put("state", "downloading").put("pct", j.pct).put("msg", j.msg)
            else if (j != null && j.state == "error") o.put("state", "error").put("msg", j.msg)
            arr.put(o)
        }
        return arr
    }

    fun downloadModel(k: String): Boolean {
        if (!(OfflineAsr.MODELS.containsKey(k) || OfflineAsr.isWhisper(k)) || asr.installed(k)) return false
        val j = MJob()
        synchronized(mjobs) { if (mjobs[k]?.state == "downloading") return true; mjobs[k] = j }
        Thread {
            try {
                val prog = { m: String -> j.msg = m; Regex("(\\d+)%").find(m)?.let { j.pct = it.groupValues[1].toInt() }; Unit }
                if (OfflineAsr.isWhisper(k)) asr.downloadWhisper(k, prog, { j.cancel }) else asr.model(k, prog, { j.cancel })
                j.pct = 100; j.state = "done"
            } catch (e: Exception) { j.state = "error"; j.msg = e.message ?: "Download failed" }
        }.start()
        return true
    }

    fun cancelModel(k: String) { synchronized(mjobs) { mjobs[k]?.cancel = true } }
    fun deleteModel(k: String) { if (OfflineAsr.MODELS.containsKey(k) || OfflineAsr.isWhisper(k)) { asr.delete(k); synchronized(mjobs) { mjobs.remove(k) } } }

    // ---- Task Manager ----
    private fun live(j: Job) = j.state == "queued" || j.state == "extracting" || j.state == "transcribing"

    fun tasks(): JSONArray {
        val arr = JSONArray()
        synchronized(jobs) {
            for (j in jobs.values.sortedByDescending { it.startedAt }) {
                val end = if (live(j)) System.currentTimeMillis() else (if (j.endedAt > 0) j.endedAt else System.currentTimeMillis())
                arr.put(JSONObject().put("id", "ai:" + j.key).put("type", "ai")
                    .put("title", niceName(j.rel)).put("file", j.rel)
                    .put("label", "AI SUBTITLES - " + (if (j.online) "Online" else "Offline"))
                    .put("state", j.state).put("pct", j.pct).put("chunk", 0).put("chunks", 0).put("lines", 0)
                    .put("elapsed", (end - j.startedAt) / 1000).put("last", if (live(j)) j.msg else "")
                    .put("opts", JSONObject().put("audioTrack", j.track).put("lang", j.lang).put("translate", j.translate).put("online", j.online).put("engine", j.engine))
                    .put("msg", if (j.state == "error" || j.state == "paused") j.msg else "").put("canPause", live(j)).put("canStop", live(j)).put("canClear", !live(j) && j.state != "paused").put("created", j.startedAt))
            }
        }
        return arr
    }

    fun stopTask(id: String): Boolean {
        var any = false
        synchronized(jobs) {
            for (j in jobs.values) {
                if (id == "all" || id == "ai:" + j.key) {
                    if (j.state == "paused") { if (id == "all") continue; j.state = "cancelled"; j.msg = "Stopped"; j.endedAt = System.currentTimeMillis(); any = true }
                    else if (j.state == "queued") { j.cancelled = true; j.state = "cancelled"; j.msg = "Stopped"; j.endedAt = System.currentTimeMillis(); any = true }
                    else if (live(j)) { j.cancelled = true; any = true }
                }
            }
        }
        return any
    }

    fun pauseTask(id: String): Boolean {
        var any = false
        synchronized(jobs) {
            for (j in jobs.values) if ((id == "all" || id == "ai:" + j.key) && live(j)) { j.pauseReq = true; j.cancelled = true; j.msg = "Pausing"; any = true }
        }
        return any
    }

    /** Continue a paused job from the last finished piece (the pieces before it are kept in the .part file). */
    fun resumeTask(id: String): Boolean {
        synchronized(jobs) {
            val j = jobs.values.firstOrNull { "ai:" + it.key == id && it.state == "paused" } ?: return false
            j.pauseReq = false; j.cancelled = false; j.state = "queued"; j.msg = "Resuming"
            Thread { run(j, j.track, j.lang, j.translate, j.online) }.start()
            return true
        }
    }

    fun clearTasks() { synchronized(jobs) { jobs.entries.removeAll { !live(it.value) && it.value.state != "paused" } } }

    // ---- API ----
    fun handle(method: String, path: String, q: (String) -> String?, b: JSONObject): Pair<Int, String>? {
        when (path) {
            "/api/ai/online" -> return online(method, b)
            "/api/tasks" -> return Pair(200, JSONObject().put("tasks", tasks()).toString())
            "/api/tasks/stop" -> return Pair(200, JSONObject().put("ok", stopTask(b.optString("id"))).toString())
            "/api/tasks/pause" -> return Pair(200, JSONObject().put("ok", pauseTask(b.optString("id"))).toString())
            "/api/tasks/resume" -> return Pair(200, JSONObject().put("ok", resumeTask(b.optString("id"))).toString())
            "/api/tasks/clear" -> { clearTasks(); return Pair(200, JSONObject().put("ok", true).toString()) }
            "/api/ai/subs/clear" -> {
                dir.listFiles()?.forEach { f -> if (f.name.endsWith(".vtt") || f.name.endsWith(".part")) f.delete() }
                synchronized(index) { index.keys().asSequence().toList().forEach { index.remove(it) } }; saveIndex()
                return Pair(200, JSONObject().put("ok", true).toString())
            }
            "/api/ai/models" -> return Pair(200, JSONObject().put("models", models()).toString())
            "/api/ai/models/download" -> return Pair(200, JSONObject().put("ok", downloadModel(b.optString("key"))).toString())
            "/api/ai/models/cancel" -> { cancelModel(b.optString("key")); return Pair(200, JSONObject().put("ok", true).toString()) }
            "/api/ai/models/delete" -> { deleteModel(b.optString("key")); return Pair(200, JSONObject().put("ok", true).toString()) }
            "/api/ai/capabilities" -> return Pair(200, capabilities().toString())
            "/api/ai/subs" -> {
                val src = if (method == "POST") null else q
                val rel = if (method == "POST") b.optString("file") else q("file") ?: ""
                val f = resolve(rel) ?: return Pair(404, JSONObject().put("error", "File not found").toString())
                val track = if (method == "POST") b.optString("audioTrack", "0:a:0") else q("audioTrack") ?: "0:a:0"
                val lang = if (method == "POST") b.optString("lang", "auto") else q("lang") ?: "auto"
                val tr = if (method == "POST") b.optBoolean("translate", false) else q("translate") == "1"
                val wantOnline = (if (method == "POST") b.optBoolean("online", false) else q("online") == "1") && key().isNotEmpty()
                val eng = (if (method == "POST") b.optString("engine", "") else q("engine") ?: "").let { if (!wantOnline && OfflineAsr.isWhisper(it)) it else "" }
                val k = keyFor(f, track, lang, tr, wantOnline, eng)
                synchronized(jobs) {
                    val j = jobs[k]
                    if (method != "POST") {
                        if (j != null && j.state in listOf("queued", "extracting", "transcribing")) return Pair(200, pub(j).toString())
                        if (vttFile(k).exists()) return Pair(200, JSONObject().put("key", k).put("state", "done").put("pct", 100).put("msg", "Subtitles ready").put("name", index.optJSONObject(k)?.optString("name") ?: niceName(rel)).toString())
                        return Pair(200, JSONObject().put("key", k).put("state", if (j != null && j.state == "error") "error" else "none").put("pct", 0).put("msg", j?.msg ?: "").toString())
                    }
                    if (tr && !wantOnline && eng.isEmpty()) return Pair(400, JSONObject().put("error", "Translating to English needs Online AI (add a key in Settings). Offline can only write the spoken language.").toString())
                    if (b.optBoolean("force", false) && (j == null || j.state !in listOf("queued", "extracting", "transcribing"))) { vttFile(k).delete(); partFile(k).delete(); index.remove(k); saveIndex() }
                    if (vttFile(k).exists()) return Pair(200, JSONObject().put("key", k).put("state", "done").put("pct", 100).toString())
                    if (j != null && j.state in listOf("queued", "extracting", "transcribing")) return Pair(200, pub(j).toString())
                    val nj = Job(k, f, rel)
                    nj.track = track; nj.lang = lang; nj.translate = tr; nj.online = wantOnline; nj.engine = eng
                    val fbReq = if (method == "POST") b.optString("fallback", "") else ""
                    nj.fb = if (fbReq == "online" && key().isNotEmpty()) "online" else if (fbReq == "vosk" || (OfflineAsr.isWhisper(fbReq) && asr.installed(fbReq) && WhisperEngine.available)) fbReq else ""
                    if (nj.fb.isNotEmpty() && nj.fb == (if (wantOnline) "online" else if (eng.isEmpty()) "vosk" else eng)) nj.fb = ""
                    if (tr && nj.fb == "vosk") nj.fb = ""   // offline Vosk cannot translate
                    jobs[k] = nj
                    Thread {
                        run(nj, track, lang, tr, wantOnline)
                        if (nj.state == "error" && nj.fb.isNotEmpty() && !nj.cancelled) {
                            val f2 = nj.fb; nj.fb = ""
                            nj.engine = if (OfflineAsr.isWhisper(f2)) f2 else ""; nj.online = f2 == "online"
                            nj.state = "queued"; nj.pct = 0; nj.msg = "First model failed, trying the backup"
                            nj.doneChunks = 0; nj.lastEnd = 0.0; nj.firstUs = -1L
                            run(nj, track, lang, tr, f2 == "online")
                        }
                    }.start()
                    return Pair(200, pub(nj).toString())
                }
            }
            "/api/ai/subs/vtt" -> {
                val k = q("key") ?: ""
                val f = if (vttFile(k).exists()) vttFile(k) else partFile(k)
                return if (Regex("[0-9a-f]{40}").matches(k) && f.exists()) Pair(200, f.readText()) else Pair(404, "Not generated yet")
            }
            "/api/ai/subs/cancel" -> {
                synchronized(jobs) { jobs[b.optString("key")]?.let { it.cancelled = true } }
                return Pair(200, JSONObject().put("ok", true).toString())
            }
            "/api/ai/subs/remove" -> {
                val k = b.optString("key")
                if (!Regex("[0-9a-f]{40}").matches(k)) return Pair(200, JSONObject().put("ok", false).toString())
                vttFile(k).delete(); partFile(k).delete(); index.remove(k); saveIndex(); synchronized(jobs) { jobs.remove(k) }
                return Pair(200, JSONObject().put("ok", true).toString())
            }
            "/api/ai/subs/for" -> {
                val f = resolve(q("file") ?: "") ?: return Pair(200, JSONObject().put("items", JSONArray()).toString())
                val arr = JSONArray()
                val it = index.keys()
                while (it.hasNext()) {
                    val k = it.next(); val e = index.optJSONObject(k) ?: continue
                    if (e.optString("path") == f.absolutePath && e.optLong("size") == f.length() && vttFile(k).exists())
                        arr.put(JSONObject(e.toString()).put("key", k).put("state", "done"))
                }
                return Pair(200, JSONObject().put("items", arr).toString())
            }
        }
        return null
    }

    // ---- the job ----
    /** How many pieces of audio are recognised at the same time: as many as the CPU and the RAM allow (the "Fast" setting), or half of that ("Balanced"). */
    private fun workers(online: Boolean): Int {
        val cores = Runtime.getRuntime().availableProcessors()
        val mem = (ctx.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager).memoryClass
        val fast = prefs.getString("perf", "fast") != "balanced"
        val byCpu = if (fast) cores - 1 else cores / 2
        val byMem = if (fast) mem / 128 else mem / 192
        return minOf(byCpu, byMem, if (online) 3 else 4).coerceAtLeast(1)
    }

    private fun run(j: Job, track: String, lang: String, translate: Boolean, online: Boolean) {
        var execRef: java.util.concurrent.ExecutorService? = null
        try {
            j.state = "extracting"; j.msg = "Reading audio"
            val ex = MediaExtractor()
            ex.setDataSource(j.file.absolutePath)
            val audio = ArrayList<Int>()
            for (i in 0 until ex.trackCount) if ((ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: "").startsWith("audio/")) audio.add(i)
            if (audio.isEmpty()) throw Exception("This video has no audio track")
            val n = Regex("a:(\\d+)$").find(track)?.groupValues?.get(1)?.toIntOrNull() ?: 0
            val ti = audio[n.coerceIn(0, audio.size - 1)]
            ex.selectTrack(ti)
            val fmt = ex.getTrackFormat(ti)
            val trackLang = if (fmt.containsKey(MediaFormat.KEY_LANGUAGE)) fmt.getString(MediaFormat.KEY_LANGUAGE) ?: "" else ""
            val langKey = OfflineAsr.lang(if (lang == "auto" || lang.isEmpty()) trackLang else lang)
            val noSpace = (if (online && lang != "auto") lang else langKey).let { it == "ja" || it == "zh" }
            var vosk: Model? = null
            val wKey = if (!online && OfflineAsr.isWhisper(j.engine)) j.engine else ""
            if (wKey.isNotEmpty()) {
                if (!WhisperEngine.available) throw Exception("The Whisper engine is not included in this build")
                if (!asr.installed(wKey)) throw Exception("Download the Whisper model first (Settings > Subtitles)")
                j.msg = "Loading the Whisper model"; j.pct = maxOf(j.pct, 2)
                j.wctx = WhisperEngine.nInit(asr.dirOf(wKey).absolutePath)
                if (j.wctx == 0L) throw Exception("Could not load the Whisper model (not enough memory?)")
            } else if (!online) {
                val dirM = asr.model(langKey, { m -> j.msg = m }, { j.cancelled })
                j.msg = "Loading the speech model"; j.pct = maxOf(j.pct, 2)
                vosk = Model(dirM.absolutePath)
            }
            var firstUs = -1L
            val durUs = if (fmt.containsKey(MediaFormat.KEY_DURATION)) fmt.getLong(MediaFormat.KEY_DURATION) else 0L
            val codec = MediaCodec.createDecoderByType(fmt.getString(MediaFormat.KEY_MIME)!!)
            codec.configure(fmt, null, null, 0)
            codec.start()

            val lowRam = (ctx.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager).memoryClass < 256
            val chunkSec = if (wKey.isNotEmpty()) 30 else if (online) (if (lowRam) 300 else 600) else 180      // online: 10-minute pieces; offline: 3-minute pieces so several can run at once
            val chunkSamples = 16000 * chunkSec
            val resuming = j.doneChunks > 0 && j.chunkSec == chunkSec && partFile(j.key).exists()
            if (!resuming) { j.doneChunks = 0; j.lastEnd = 0.0; j.firstUs = -1L }
            j.chunkSec = chunkSec
            val vtt = StringBuilder(if (resuming) partFile(j.key).readText() else "WEBVTT\n\n")
            var lastEnd = if (resuming) j.lastEnd else 0.0
            if (resuming) firstUs = j.firstUs
            var pcm = ShortArray(chunkSamples)
            var cnt = 0
            var chunkIndex = if (resuming) j.doneChunks else 0
            var rate = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var ch = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var acc = 0.0           // resampler position
            val info = MediaCodec.BufferInfo()
            var inDone = false
            var outDone = false
            var lastUs = 0L
            if (resuming) { j.msg = "Continuing from part " + (j.doneChunks + 1); ex.seekTo((maxOf(firstUs, 0L)) + j.doneChunks * chunkSec * 1_000_000L, MediaExtractor.SEEK_TO_PREVIOUS_SYNC) }

            val nWorkers = if (wKey.isNotEmpty()) 1 else workers(online)
            val exec = java.util.concurrent.Executors.newFixedThreadPool(nWorkers); execRef = exec
            val pending = ArrayDeque<Pair<Int, java.util.concurrent.Future<List<W>>>>()   // pieces in order, being recognised right now
            val totalChunks = if (durUs > 0) Math.ceil(durUs / 1e6 / chunkSec).toInt().coerceAtLeast(1) else 1
            var doneChunks = if (resuming) j.doneChunks else 0
            val totalSamples = if (durUs > 0) (durUs / 1e6 * 16000).toLong().coerceAtLeast(1) else 0L
            val doneSamples = java.util.concurrent.atomic.AtomicLong(if (resuming) doneChunks.toLong() * chunkSamples else 0L)
            // real progress: share of the audio that has been recognised so far (updated while a piece is still being worked on)
            val bump = { d: Long ->
                val done = doneSamples.addAndGet(d)
                if (totalSamples > 0) j.pct = maxOf(j.pct, (3 + 92 * done / totalSamples).toInt().coerceIn(3, 95))
            }

            fun emit(idx: Int, words: List<W>) {
                val off = (if (firstUs > 0) firstUs / 1e6 else 0.0) + idx * chunkSec.toDouble()
                for (c in group(words, off, noSpace, lastEnd)) {
                    vtt.append(ts(c.s)).append(" --> ").append(ts(c.e)).append('\n').append(c.t).append("\n\n")
                    lastEnd = c.e
                }
                partFile(j.key).writeText(vtt.toString())
                doneChunks++
                j.doneChunks = doneChunks; j.lastEnd = lastEnd; j.firstUs = firstUs
                if (totalSamples == 0L) j.pct = (3 + doneChunks * 92 / totalChunks).coerceAtMost(95)
                j.msg = (if (online) "Transcribed " else "Listened to ") + doneChunks + " of " + totalChunks + " parts" + (if (nWorkers > 1) " (" + nWorkers + " at once)" else "")
            }
            fun drain(all: Boolean, keep: Int) {
                while (pending.isNotEmpty() && (all || pending.size > keep || pending.first().second.isDone)) {
                    if (j.cancelled) return
                    val h = pending.removeFirst()
                    val words = try { h.second.get() } catch (e: java.util.concurrent.ExecutionException) { throw Exception(if (e.cause is OutOfMemoryError) "Not enough memory on this phone. Set Performance to Balanced and try again" else (e.cause?.message ?: "Recognition failed")) }
                    emit(h.first, words)
                }
            }
            fun flush(last: Boolean) {
                if (cnt < 16000) { cnt = 0; return }            // under 1 second: nothing to say
                j.state = "transcribing"
                val data = pcm; val n = cnt
                pcm = ShortArray(chunkSamples); cnt = 0
                val idx = chunkIndex++
                pending.addLast(Pair(idx, exec.submit(java.util.concurrent.Callable<List<W>> {
                    if (wKey.isNotEmpty()) { val w = whisperChunk(j.wctx, data, n, lang, translate, noSpace); bump(n.toLong()); w } else if (online) { val w = transcribe(wav(data, n), lang, translate, j, noSpace); bump(n.toLong()); w } else asr.recognize(vosk!!, data, n) { d -> bump(d.toLong()) }
                })))
                drain(false, nWorkers + 1)                       // never hold more than a few pieces in memory
            }

            while (!outDone) {
                if (j.cancelled) { exec.shutdownNow(); if (wKey.isNotEmpty()) try { exec.awaitTermination(90, java.util.concurrent.TimeUnit.SECONDS) } catch (e: Exception) { }; codec.stop(); codec.release(); ex.release(); closeAsr(j, vosk); halt(j); return }
                if (!inDone) {
                    val ii = codec.dequeueInputBuffer(10000)
                    if (ii >= 0) {
                        val sz = ex.readSampleData(codec.getInputBuffer(ii)!!, 0)
                        if (sz < 0) { codec.queueInputBuffer(ii, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inDone = true }
                        else { lastUs = ex.sampleTime; if (firstUs < 0) firstUs = lastUs; codec.queueInputBuffer(ii, 0, sz, lastUs, 0); ex.advance() }
                    }
                }
                val oi = codec.dequeueOutputBuffer(info, 10000)
                if (oi >= 0) {
                    val ob = codec.getOutputBuffer(oi)!!
                    ob.order(ByteOrder.LITTLE_ENDIAN)
                    val sb = ob.asShortBuffer()
                    val frames = sb.remaining() / ch
                    val step = rate / 16000.0
                    val tmp = ShortArray(sb.remaining()); sb.get(tmp)
                    var f = 0
                    while (true) {
                        val pos = acc.toInt()
                        if (pos >= frames) break
                        var sum = 0
                        for (c in 0 until ch) sum += tmp[pos * ch + c]
                        pcm[cnt++] = (sum / ch).toShort()
                        acc += step
                        if (cnt >= chunkSamples) { flush(false) }
                    }
                    acc -= frames
                    if (acc < 0) acc = 0.0
                    codec.releaseOutputBuffer(oi, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outDone = true
                    } else if (oi == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    val nf = codec.outputFormat
                    rate = nf.getInteger(MediaFormat.KEY_SAMPLE_RATE); ch = nf.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                }
            }
            codec.stop(); codec.release(); ex.release()
            flush(true)
            drain(true, 0)
            exec.shutdown()
            if (j.cancelled) { closeAsr(j, vosk); halt(j); return }
            closeAsr(j, vosk)
            vttFile(j.key).writeText(vtt.toString())
            partFile(j.key).delete()
            index.put(j.key, JSONObject().put("path", j.file.absolutePath).put("size", j.file.length())
                .put("name", niceName(j.rel) + (if (online) " (AI)" else " (offline AI)")).put("lang", lang).put("translate", translate).put("model", model()).put("created", System.currentTimeMillis()))
            saveIndex()
            j.pct = 100; j.state = "done"; j.msg = "Subtitles ready"; j.endedAt = System.currentTimeMillis()
        } catch (e: Exception) {
            try { execRef?.shutdownNow(); if (j.wctx != 0L) execRef?.awaitTermination(90, java.util.concurrent.TimeUnit.SECONDS) } catch (x: Exception) { }
            closeAsr(j, null)
            if (j.pauseReq) { halt(j); return }
            j.state = "error"; j.msg = e.message ?: "Subtitle generation failed"; j.endedAt = System.currentTimeMillis()
        } catch (e: OutOfMemoryError) {
            try { execRef?.shutdownNow() } catch (x: Exception) { }
            j.state = "error"; j.msg = "Not enough memory on this phone. Set Performance to Balanced and try again"; j.endedAt = System.currentTimeMillis()
        }
    }

    private fun closeAsr(j: Job, vosk: Model?) {
        try { vosk?.close() } catch (e: Exception) { }
        val w = j.wctx; if (w != 0L) { j.wctx = 0L; try { WhisperEngine.nFree(w) } catch (e: Throwable) { } }
    }

    /** One piece of audio through whisper.cpp. Segments are spread into words so the usual cue grouping can be used. */
    private fun whisperChunk(w: Long, data: ShortArray, n: Int, lang: String, translate: Boolean, noSpace: Boolean): List<W> {
        val f = FloatArray(n) { data[it] / 32768f }
        val threads = Runtime.getRuntime().availableProcessors().coerceIn(2, 4)
        val raw = String(WhisperEngine.nRun(w, f, if (lang.isEmpty()) "auto" else lang, translate, threads), Charsets.UTF_8)
        val out = ArrayList<W>()
        for (ln in raw.split('\n')) {
            val p = ln.split('\t', limit = 3); if (p.size < 3) continue
            val st = (p[0].toDoubleOrNull() ?: continue) / 100.0; val en = (p[1].toDoubleOrNull() ?: continue) / 100.0
            val text = p[2].trim()
            if (text.isEmpty() || (text.startsWith("[") && text.endsWith("]")) || (text.startsWith("(") && text.endsWith(")"))) continue
            val parts = if (noSpace) text.map { it.toString() } else text.split(Regex("\\s+")).filter { it.isNotEmpty() }
            val tot = parts.sumOf { it.length }.coerceAtLeast(1)
            var at = st
            for (q in parts) { val d = (en - st) * q.length / tot; out.add(W(at, at + d, q)); at += d }
        }
        return out
    }

    private fun halt(j: Job) {
        if (j.pauseReq) { j.state = "paused"; j.msg = "Paused at " + j.pct + "%. Resume continues where it stopped" }
        else { j.state = "cancelled"; j.msg = "Cancelled"; j.endedAt = System.currentTimeMillis() }
    }

    private fun ts(sec: Double): String {
        val ms = (sec * 1000).toLong().coerceAtLeast(0)
        return "%02d:%02d:%02d.%03d".format(ms / 3600000, ms / 60000 % 60, ms / 1000 % 60, ms % 1000)
    }

    private fun wav(pcm: ShortArray, n: Int): ByteArray {
        val data = n * 2
        val o = ByteArrayOutputStream(44 + data)
        fun i32(v: Int) { o.write(v and 255); o.write(v shr 8 and 255); o.write(v shr 16 and 255); o.write(v shr 24 and 255) }
        fun i16(v: Int) { o.write(v and 255); o.write(v shr 8 and 255) }
        o.write("RIFF".toByteArray()); i32(36 + data); o.write("WAVEfmt ".toByteArray())
        i32(16); i16(1); i16(1); i32(16000); i32(32000); i16(2); i16(16)
        o.write("data".toByteArray()); i32(data)
        val bb = java.nio.ByteBuffer.allocate(data).order(ByteOrder.LITTLE_ENDIAN)
        for (i in 0 until n) bb.putShort(pcm[i])
        o.write(bb.array())
        return o.toByteArray()
    }

    private data class Cue(val s: Double, val e: Double, val t: String)

    /**
     * Words -> subtitle lines: one line of about 8-12 words (or about 24 characters for Japanese / Chinese),
     * a line ends at a sentence end or a pause, and each line is shown exactly while its words are spoken.
     */
    private fun group(words: List<W>, off: Double, noSpace: Boolean, prevEnd: Double): List<Cue> {
        val w = words.filter { it.t.isNotBlank() && it.e >= it.s }
        val out = ArrayList<Cue>()
        var i = 0
        while (i < w.size) {
            var j = i
            var chars = 0
            while (true) {
                val cur = w[j]
                chars += cur.t.length + (if (noSpace) 0 else 1)
                val count = j - i + 1
                val ends = Regex("[.!?\u3002\uff01\uff1f\u2026]$").containsMatchIn(cur.t.trim())
                val comma = Regex("[,;:\u3001\uff0c]$").containsMatchIn(cur.t.trim())
                val gap = if (j + 1 < w.size) w[j + 1].s - cur.e else 99.0
                val full = if (noSpace) chars >= 24 else count >= 12 || chars > 80
                val soft = if (noSpace) chars >= 12 else count >= 8
                if (j + 1 >= w.size || full || (soft && (ends || (comma && count >= 10))) || gap > 0.9 || (cur.e - w[i].s) > 6.5) break
                j++
            }
            val text = w.subList(i, j + 1).joinToString(if (noSpace) "" else " ") { it.t.trim() }.replace(Regex("\\s+"), " ").trim()
            if (text.isNotEmpty()) out.add(Cue(w[i].s + off, w[j].e + off, text))
            i = j + 1
        }
        // timing: never overlap, never flash by too fast, never linger into the next line
        for (k in out.indices) {
            val c = out[k]
            val nextS = if (k + 1 < out.size) out[k + 1].s else Double.MAX_VALUE
            var s = maxOf(c.s, prevEnd + 0.02, if (k > 0) out[k - 1].e + 0.02 else 0.0)
            var e = maxOf(c.e + 0.15, s + 0.8)
            e = minOf(e, nextS - 0.03, s + 7.0)
            if (e <= s) e = s + 0.3
            out[k] = Cue(s, e, c.t)
        }
        return out
    }

    /** Words with start / end times from an OpenAI-compatible API. Retries a few times on rate limits. */
    private fun transcribe(wav: ByteArray, lang: String, translate: Boolean, j: Job, noSpace: Boolean): List<W> {
        var last: Exception? = null
        val order = modelOrder().filter { !badModels.contains(it) }.ifEmpty { modelOrder() }
        for (m in order) {
            try { return transcribeWith(m, wav, lang, translate, j, noSpace) }
            catch (e: Exception) {
                if ((e.message ?: "").contains("key was refused") || j.cancelled) throw e
                if (order.size > 1) badModels.add(m)
                last = e
            }
        }
        throw last ?: Exception("Request failed")
    }

    private fun transcribeWith(mdl: String, wav: ByteArray, lang: String, translate: Boolean, j: Job, noSpace: Boolean): List<W> {
        var lastErr = "Request failed"
        for (attempt in 0 until 4) {
            if (j.cancelled) return emptyList()
            val boundary = "----astra" + System.nanoTime()
            val url = URL(base() + if (translate) "/audio/translations" else "/audio/transcriptions")
            val c = url.openConnection() as HttpURLConnection
            try {
                c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 20000; c.readTimeout = 180000
                c.setChunkedStreamingMode(64 * 1024)      // stream the audio instead of holding a second full copy in memory
                c.setRequestProperty("Authorization", "Bearer " + key())
                c.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
                val os = c.outputStream
                fun field(n: String, v: String) { os.write("--$boundary\r\nContent-Disposition: form-data; name=\"$n\"\r\n\r\n$v\r\n".toByteArray()) }
                field("model", mdl); field("response_format", "verbose_json"); field("temperature", "0")
                if (!translate) { field("timestamp_granularities[]", "word"); field("timestamp_granularities[]", "segment") }
                if (!translate && lang != "auto" && lang.isNotEmpty()) field("language", lang)
                os.write("--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\nContent-Type: audio/wav\r\n\r\n".toByteArray())
                os.write(wav); os.write("\r\n--$boundary--\r\n".toByteArray()); os.flush()
                val code = c.responseCode
                val text = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.readText() ?: ""
                if (code in 200..299) {
                    val root = JSONObject(text)
                    val out = ArrayList<W>()
                    val ws = root.optJSONArray("words")
                    if (ws != null && ws.length() > 0) {
                        for (i in 0 until ws.length()) { val o = ws.getJSONObject(i); out.add(W(o.optDouble("start"), o.optDouble("end"), o.optString("word"))) }
                        return out
                    }
                    // no word times (translations, some APIs): spread each segment's text over its time
                    val segs = root.optJSONArray("segments") ?: JSONArray()
                    for (i in 0 until segs.length()) {
                        val sg = segs.getJSONObject(i)
                        val st = sg.optDouble("start"); val en = sg.optDouble("end")
                        val parts = if (noSpace) sg.optString("text").trim().map { it.toString() } else sg.optString("text").trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
                        val tot = parts.sumOf { it.length }.coerceAtLeast(1)
                        var at = st
                        for (p in parts) { val d = (en - st) * p.length / tot; out.add(W(at, at + d, p)); at += d }
                    }
                    return out
                }
                lastErr = try { JSONObject(text).getJSONObject("error").getString("message") } catch (e: Exception) { "HTTP $code" }
                if (code == 401 || code == 403) throw Exception("The API key was refused ($code)")
                if (code == 429 || code >= 500) { Thread.sleep(8000L * (attempt + 1)); continue }
                throw Exception(lastErr)
            } catch (e: java.io.IOException) {
                lastErr = "Connection problem: " + (e.message ?: "no internet"); Thread.sleep(3000)
            } finally { c.disconnect() }
        }
        throw Exception(lastErr)
    }
}
