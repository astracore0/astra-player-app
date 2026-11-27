package com.astracore.astraplayer

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile

/** Reads chapter marks from a Matroska/WebM file (Chapters element) and names them like the server did. */
object Chapters {
    private class Chap(val startNs: Long, val endNs: Long, val title: String)

    private const val ID_EBML = 0x1A45DFA3L
    private const val ID_SEGMENT = 0x18538067L
    private const val ID_SEEKHEAD = 0x114D9B74L
    private const val ID_CLUSTER = 0x1F43B675L
    private const val ID_CHAPTERS = 0x1043A770L

    private fun readId(raf: RandomAccessFile): Long {
        val b = raf.read()
        if (b < 0) return -1
        var len = 1
        var mask = 0x80
        while (len <= 4 && (b and mask) == 0) { len++; mask = mask shr 1 }
        if (len > 4) return -1
        var v = b.toLong()
        for (i in 1 until len) { val x = raf.read(); if (x < 0) return -1; v = (v shl 8) or x.toLong() }
        return v
    }

    /** Element size; -1 means "unknown", -2 means a read error. */
    private fun readSize(raf: RandomAccessFile): Long {
        val b = raf.read()
        if (b < 0) return -2
        var len = 1
        var mask = 0x80
        while (len <= 8 && (b and mask) == 0) { len++; mask = mask shr 1 }
        if (len > 8) return -2
        var v = (b and (mask - 1)).toLong()
        var ones = v == (mask - 1).toLong()
        for (i in 1 until len) {
            val x = raf.read()
            if (x < 0) return -2
            if (x != 0xFF) ones = false
            v = (v shl 8) or x.toLong()
        }
        return if (ones) -1 else v
    }

    // ---- in-memory parsing of the (small) Chapters element ----
    private fun vint(buf: ByteArray, pos: Int, keepMarker: Boolean): LongArray {   // [value, length]
        val b = buf[pos].toInt() and 0xFF
        var len = 1
        var mask = 0x80
        while (len <= 8 && (b and mask) == 0) { len++; mask = mask shr 1 }
        var v = if (keepMarker) b.toLong() else (b and (mask - 1)).toLong()
        for (i in 1 until len) v = (v shl 8) or (buf[pos + i].toLong() and 0xFF)
        return longArrayOf(v, len.toLong())
    }

    private fun uint(buf: ByteArray, from: Int, to: Int): Long {
        var v = 0L
        for (i in from until to) v = (v shl 8) or (buf[i].toLong() and 0xFF)
        return v
    }

    private fun parseDisplay(buf: ByteArray, from: Int, to: Int, cur: String): String {
        var p = from
        var title = cur
        while (p < to) {
            val id = vint(buf, p, true); p += id[1].toInt()
            val sz = vint(buf, p, false); p += sz[1].toInt()
            val end = minOf(to.toLong(), p + sz[0]).toInt()
            if (id[0] == 0x85L && title.isEmpty()) title = String(buf, p, end - p, Charsets.UTF_8)
            p = end
        }
        return title
    }

    private fun parseAtom(buf: ByteArray, from: Int, to: Int, out: MutableList<Chap>) {
        var s = -1L
        var e = -1L
        var title = ""
        val nested = mutableListOf<Chap>()
        var p = from
        while (p < to) {
            val id = vint(buf, p, true); p += id[1].toInt()
            val sz = vint(buf, p, false); p += sz[1].toInt()
            val end = minOf(to.toLong(), p + sz[0]).toInt()
            when (id[0]) {
                0x91L -> s = uint(buf, p, end)
                0x92L -> e = uint(buf, p, end)
                0x80L -> title = parseDisplay(buf, p, end, title)
                0xB6L -> parseAtom(buf, p, end, nested)
            }
            p = end
        }
        if (s >= 0) out.add(Chap(s, e, title))
        out.addAll(nested)
    }

    private fun parseChapters(buf: ByteArray): List<Chap> {
        val out = mutableListOf<Chap>()
        var p = 0
        while (p < buf.size) {
            val id = vint(buf, p, true); p += id[1].toInt()
            val sz = vint(buf, p, false); p += sz[1].toInt()
            val end = minOf(buf.size.toLong(), p + sz[0]).toInt()
            if (id[0] == 0x45B9L) {   // first edition only
                var q = p
                while (q < end) {
                    val cid = vint(buf, q, true); q += cid[1].toInt()
                    val cs = vint(buf, q, false); q += cs[1].toInt()
                    val ce = minOf(end.toLong(), q + cs[0]).toInt()
                    if (cid[0] == 0xB6L) parseAtom(buf, q, ce, out)
                    q = ce
                }
                break
            }
            p = end
        }
        return out
    }

    private fun seekFor(buf: ByteArray, wanted: Long, segStart: Long): Long {
        var p = 0
        while (p < buf.size) {
            val id = vint(buf, p, true); p += id[1].toInt()
            val sz = vint(buf, p, false); p += sz[1].toInt()
            val end = minOf(buf.size.toLong(), p + sz[0]).toInt()
            if (id[0] == 0x4DBBL) {
                var q = p
                var sid = -1L
                var pos = -1L
                while (q < end) {
                    val cid = vint(buf, q, true); q += cid[1].toInt()
                    val cs = vint(buf, q, false); q += cs[1].toInt()
                    val ce = minOf(end.toLong(), q + cs[0]).toInt()
                    if (cid[0] == 0x53ABL) sid = uint(buf, q, ce)
                    if (cid[0] == 0x53ACL) pos = uint(buf, q, ce)
                    q = ce
                }
                if (sid == wanted && pos >= 0) return segStart + pos
            }
            p = end
        }
        return -1
    }

    private fun readAt(raf: RandomAccessFile, pos: Long): List<Chap>? {
        raf.seek(pos)
        val id = readId(raf)
        val sz = readSize(raf)
        if (id != ID_CHAPTERS || sz <= 0 || sz > 2_000_000) return null
        val buf = ByteArray(sz.toInt())
        raf.readFully(buf)
        return parseChapters(buf)
    }

    private fun find(f: File): List<Chap> {
        RandomAccessFile(f, "r").use { raf ->
            if (readId(raf) != ID_EBML) return emptyList()
            val hs = readSize(raf)
            if (hs < 0) return emptyList()
            raf.seek(raf.filePointer + hs)
            if (readId(raf) != ID_SEGMENT) return emptyList()
            readSize(raf)
            val segStart = raf.filePointer
            var chapPos = -1L
            var steps = 0
            while (raf.filePointer < raf.length() && steps < 200) {
                steps++
                val id = readId(raf)
                val sz = readSize(raf)
                if (id < 0 || sz < 0) break
                val data = raf.filePointer
                when (id) {
                    ID_CHAPTERS -> {
                        if (sz !in 1..2_000_000L) return emptyList()
                        val buf = ByteArray(sz.toInt()); raf.readFully(buf)
                        return parseChapters(buf)
                    }
                    ID_SEEKHEAD -> {
                        if (sz in 1..65536) {
                            val buf = ByteArray(sz.toInt()); raf.readFully(buf)
                            val p = seekFor(buf, ID_CHAPTERS, segStart)
                            if (p >= 0) chapPos = p
                        }
                        raf.seek(data + sz)
                    }
                    ID_CLUSTER -> {
                        if (chapPos >= 0) return readAt(raf, chapPos) ?: emptyList()
                        return emptyList()
                    }
                    else -> raf.seek(data + sz)
                }
            }
            if (chapPos >= 0) return readAt(raf, chapPos) ?: emptyList()
        }
        return emptyList()
    }

    /** Chapters as [{start, end, title}] in seconds, named "1 • Opening" etc.; empty when the file has none. */
    fun read(f: File, durationSec: Double): JSONArray {
        val out = JSONArray()
        try {
            if (f.extension.lowercase() !in setOf("mkv", "webm", "mka")) return out
            val list = find(f).sortedBy { it.startNs }
            if (list.isEmpty()) return out
            for (i in list.indices) {
                val c = list[i]
                val start = c.startNs / 1e9
                var end = if (c.endNs > c.startNs) c.endNs / 1e9 else if (i + 1 < list.size) list[i + 1].startNs / 1e9 else durationSec
                if (end < start) end = start
                val raw = c.title.trim()
                val stripped = raw.replace(Regex("^\\d+\\s*[•·\\-]\\s*"), "").trim()
                val generic = stripped.isEmpty() || Regex("^chapter\\s*0*\\d+$", RegexOption.IGNORE_CASE).matches(stripped)
                var label = stripped
                if (generic) {
                    val dur = end - start
                    val n = list.size
                    label = when {
                        i == 0 && dur > 0 && dur <= 130 && n >= 3 -> if (start < 15) "Opening" else "Prologue"
                        i == 1 && dur in 75.0..115.0 && n >= 4 -> "Opening"
                        i == n - 1 && dur > 0 && dur <= 40 && n >= 3 -> "Preview"
                        (i == n - 1 || i == n - 2) && dur in 75.0..115.0 && n >= 3 -> "Ending"
                        else -> "Part " + ('A' + minOf(i, 25))
                    }
                }
                out.put(JSONObject().put("start", start).put("end", end).put("title", "${i + 1} • $label"))
            }
        } catch (e: Exception) { }
        return out
    }
}
