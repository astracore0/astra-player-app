package com.astracore.astraplayer

import java.io.File
import java.io.RandomAccessFile
import java.util.Locale

/** Reads the real audio / subtitle track names ("Hindi", "English [Full]") from a Matroska file's Tracks element. */
object TrackNames {
    class T(val type: Int, val name: String, val lang: String)

    private fun vint(b: ByteArray, p: Int, keep: Boolean): LongArray {
        val f = b[p].toInt() and 0xFF
        var len = 1; var mask = 0x80
        while (len <= 8 && (f and mask) == 0) { len++; mask = mask shr 1 }
        var v = if (keep) f.toLong() else (f and (mask - 1)).toLong()
        for (i in 1 until len) v = (v shl 8) or (b[p + i].toLong() and 0xFF)
        return longArrayOf(v, len.toLong())
    }

    fun read(f: File): List<T> {
        val ext = f.extension.lowercase()
        if (ext != "mkv" && ext != "webm" && ext != "mka") return emptyList()
        return try {
            val buf = ByteArray(3_000_000)
            val n = RandomAccessFile(f, "r").use { it.read(buf) }
            if (n < 100) return emptyList()
            var at = -1
            for (i in 0 until n - 4) if (buf[i] == 0x16.toByte() && buf[i + 1] == 0x54.toByte() && buf[i + 2] == 0xAE.toByte() && buf[i + 3] == 0x6B.toByte()) { at = i; break }
            if (at < 0) return emptyList()
            var p = at + 4
            val sz = vint(buf, p, false); p += sz[1].toInt()
            val end = minOf(n.toLong(), p + sz[0]).toInt()
            val out = ArrayList<T>()
            while (p < end) {
                val id = vint(buf, p, true); p += id[1].toInt()
                val s = vint(buf, p, false); p += s[1].toInt()
                val e = minOf(end.toLong(), p + s[0]).toInt()
                if (id[0] == 0xAEL) {
                    var type = 0; var name = ""; var lang = ""
                    var q = p
                    while (q < e) {
                        val cid = vint(buf, q, true); q += cid[1].toInt()
                        val cs = vint(buf, q, false); q += cs[1].toInt()
                        val ce = minOf(e.toLong(), q + cs[0]).toInt()
                        when (cid[0]) {
                            0x83L -> { var v = 0; for (k in q until ce) v = (v shl 8) or (buf[k].toInt() and 0xFF); type = v }
                            0x536EL -> name = String(buf, q, ce - q, Charsets.UTF_8).trim()
                            0x22B59CL -> if (lang.isEmpty()) lang = String(buf, q, ce - q, Charsets.UTF_8).trim { it <= ' ' || it == '\u0000' }
                            0x22B59DL -> lang = String(buf, q, ce - q, Charsets.UTF_8).trim { it <= ' ' || it == '\u0000' }
                        }
                        q = ce
                    }
                    out.add(T(type, name, lang))
                }
                p = e
            }
            out
        } catch (e: Exception) { emptyList() }
    }

    /** "jpn" / "ja" / "en-US" -> "Japanese" / "English". "und" -> "". */
    fun language(code: String): String {
        val c = code.trim().lowercase()
        if (c.isEmpty() || c == "und" || c == "zxx") return ""
        val l = Locale(c.substringBefore('-')).getDisplayLanguage(Locale.ENGLISH)
        return if (l.isNullOrEmpty() || l.equals(c, true)) c.uppercase() else l
    }

    /** Best human name for a track: the title in the file, else the language. */
    fun title(t: T?, fallback: String): String {
        if (t == null) return fallback
        val lang = language(t.lang)
        return when {
            t.name.isNotEmpty() && lang.isNotEmpty() && !t.name.contains(lang, true) -> "${t.name} • $lang"
            t.name.isNotEmpty() -> t.name
            lang.isNotEmpty() -> lang
            else -> fallback
        }
    }
}
