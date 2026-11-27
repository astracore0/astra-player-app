package com.astracore.astraplayer

import android.content.Context
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream

/** One recognised word: start / end in seconds (relative to the audio piece) and its text. */
data class W(val s: Double, val e: Double, val t: String)

/** Offline speech-to-text with Vosk. The small language model (about 40-50 MB) is downloaded once, then everything runs on the phone. */
class OfflineAsr(ctx: Context) {
    private val appCtx = ctx.applicationContext
    private val root = Storage.models(ctx)

    companion object {
        val MODELS = mapOf(
            "en" to "vosk-model-small-en-us-0.15", "ja" to "vosk-model-small-ja-0.22", "hi" to "vosk-model-small-hi-0.22",
            "zh" to "vosk-model-small-cn-0.22", "ko" to "vosk-model-small-ko-0.22", "ru" to "vosk-model-small-ru-0.22",
            "es" to "vosk-model-small-es-0.42", "fr" to "vosk-model-small-fr-0.22", "de" to "vosk-model-small-de-0.15",
            "it" to "vosk-model-small-it-0.22", "pt" to "vosk-model-small-pt-0.3", "tr" to "vosk-model-small-tr-0.3",
            "uk" to "vosk-model-small-uk-v3-small"
        )
        val SIZE_MB = mapOf("en" to 40, "ja" to 48, "hi" to 42, "zh" to 42, "ko" to 82, "ru" to 45, "es" to 39, "fr" to 41, "de" to 45, "it" to 48, "pt" to 31, "tr" to 35, "uk" to 73)
        /** whisper.cpp models (single ggml files). Download / delete only for now: the app does not run them yet. */
        val WHISPER = mapOf("whisper-tiny" to "ggml-tiny.bin", "whisper-base" to "ggml-base.bin")
        val WHISPER_MB = mapOf("whisper-tiny" to 75, "whisper-base" to 142)
        fun isWhisper(k: String) = WHISPER.containsKey(k)
        private val ISO3 = mapOf("eng" to "en", "jpn" to "ja", "hin" to "hi", "zho" to "zh", "chi" to "zh", "kor" to "ko", "rus" to "ru",
            "spa" to "es", "fra" to "fr", "fre" to "fr", "deu" to "de", "ger" to "de", "ita" to "it", "por" to "pt", "tur" to "tr", "ukr" to "uk")

        /** "jpn", "ja", "ja-JP", "auto", "und" -> a key of MODELS ("en" when unknown). */
        fun lang(code: String): String {
            val c = code.lowercase().substringBefore('-')
            val two = ISO3[c] ?: c
            return if (MODELS.containsKey(two)) two else "en"
        }
    }

    private fun wFile(k: String) = File(File(root, "whisper").also { it.mkdirs() }, WHISPER[k] ?: "none.bin")
    fun dirOf(langKey: String): File = if (isWhisper(langKey)) wFile(langKey) else File(root, MODELS[langKey] ?: MODELS["en"]!!)
    fun installed(langKey: String): Boolean { if (isWhisper(langKey)) return wFile(langKey).let { it.isFile && it.length() > 1_000_000 }; val d = dirOf(langKey); return File(d, "am").exists() || File(d, "conf").exists() }
    fun delete(langKey: String) {
        if (isWhisper(langKey)) { wFile(langKey).delete(); File(wFile(langKey).path + ".part").delete(); return }
        dirOf(langKey).deleteRecursively(); File(root, (MODELS[langKey] ?: "") + ".zip").delete()
    }

    /** Downloads a whisper.cpp ggml model (from the official whisper.cpp Hugging Face page) to the models folder. */
    fun downloadWhisper(k: String, progress: (String) -> Unit, cancelled: () -> Boolean) {
        val f = wFile(k); val part = File(f.path + ".part")
        val url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/" + (WHISPER[k] ?: return)
        progress("Downloading Whisper model 0%")
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 20000; c.readTimeout = 60000
            if (c.responseCode !in 200..299) throw Exception("Could not download the model (HTTP ${c.responseCode})")
            val total = c.contentLengthLong
            c.inputStream.use { ins -> part.outputStream().use { out ->
                val buf = ByteArray(65536); var done = 0L; var last = 0L
                while (true) {
                    if (cancelled()) { part.delete(); throw Exception("Cancelled") }
                    val n = ins.read(buf); if (n < 0) break
                    out.write(buf, 0, n); done += n
                    if (total > 0 && done - last > 1_000_000) { last = done; progress("Downloading Whisper model ${done * 100 / total}%") }
                }
            } }
            if (!part.renameTo(f)) throw Exception("Could not save the model")
        } catch (e: java.io.IOException) { part.delete(); throw Exception("No internet connection for the model download") }
        finally { c.disconnect() }
    }

    /** Folder of the unpacked model; downloads it on first use. */
    fun model(langKey: String, progress: (String) -> Unit, cancelled: () -> Boolean): File {
        val name = MODELS[langKey] ?: MODELS["en"]!!
        val dir = File(root, name)
        if (File(dir, "am").exists() || File(dir, "conf").exists()) return dir
        // optional: a model shipped inside the APK is used first; normally there is none and the model is downloaded below
        val bundled = try { appCtx.assets.open("models/$name.zip") } catch (e: Exception) { null }
        if (bundled != null) {
            progress("Unpacking the built-in speech model (first use only)")
            val canon0 = root.canonicalPath
            bundled.use { ins ->
                ZipInputStream(ins).use { zin ->
                    while (true) {
                        if (cancelled()) throw Exception("Cancelled")
                        val e = zin.nextEntry ?: break
                        val f = File(root, e.name)
                        if (!f.canonicalPath.startsWith(canon0)) continue
                        if (e.isDirectory) f.mkdirs() else { f.parentFile?.mkdirs(); f.outputStream().use { zin.copyTo(it) } }
                    }
                }
            }
            if (dir.isDirectory && (File(dir, "am").exists() || File(dir, "conf").exists())) return dir
        }
        val zip = File(root, "$name.zip")
        val url = "https://alphacephei.com/vosk/models/$name.zip"
        progress("Downloading the offline speech model (one time)")
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 20000; c.readTimeout = 60000
            if (c.responseCode !in 200..299) throw Exception("Could not download the offline model (HTTP ${c.responseCode}). $url")
            val total = c.contentLengthLong
            c.inputStream.use { ins ->
                zip.outputStream().use { out ->
                    val buf = ByteArray(65536); var done = 0L; var last = 0L
                    while (true) {
                        if (cancelled()) throw Exception("Cancelled")
                        val n = ins.read(buf); if (n < 0) break
                        out.write(buf, 0, n); done += n
                        if (total > 0 && done - last > 2_000_000) { last = done; progress("Downloading the offline speech model ${(done * 100 / total)}%") }
                    }
                }
            }
        } catch (e: java.io.IOException) { zip.delete(); throw Exception("No internet connection for the one-time model download") }
        finally { c.disconnect() }
        progress("Unpacking the model")
        val canon = root.canonicalPath
        ZipInputStream(zip.inputStream()).use { zin ->
            while (true) {
                val e = zin.nextEntry ?: break
                val f = File(root, e.name)
                if (!f.canonicalPath.startsWith(canon)) continue      // never write outside the model folder
                if (e.isDirectory) f.mkdirs() else { f.parentFile?.mkdirs(); f.outputStream().use { zin.copyTo(it) } }
            }
        }
        zip.delete()
        if (!dir.isDirectory) throw Exception("The downloaded model has an unexpected layout")
        return dir
    }

    fun recognize(model: Model, pcm: ShortArray, n: Int, onProgress: (Int) -> Unit = {}): List<W> {
        val out = ArrayList<W>()
        val rec = Recognizer(model, 16000f)
        rec.setWords(true)
        fun take(json: String) {
            val arr = try { JSONObject(json).optJSONArray("result") } catch (e: Exception) { null } ?: return
            for (i in 0 until arr.length()) { val o = arr.getJSONObject(i); out.add(W(o.optDouble("start"), o.optDouble("end"), o.optString("word"))) }
        }
        var i = 0
        while (i < n) {
            val e = minOf(n, i + 4000)
            if (rec.acceptWaveForm(pcm.copyOfRange(i, e), e - i)) take(rec.result)
            onProgress(e - i)
            i = e
        }
        take(rec.finalResult)
        rec.close()
        return out
    }
}
