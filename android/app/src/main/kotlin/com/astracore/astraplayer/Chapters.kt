package com.astracore.astraplayer

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile

/** Reads chapter marks from Matroska/WebM (Chapters element) and MP4/M4V/MOV (chpl atom or QuickTime chapter track) and names them like the server did. */
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


    // ---------------- MP4 / M4V / MOV ----------------
    private class Box(val type: String, val s: Int, val e: Int)
    private fun u32(b: ByteArray, p: Int): Long = ((b[p].toLong() and 0xFF) shl 24) or ((b[p + 1].toLong() and 0xFF) shl 16) or ((b[p + 2].toLong() and 0xFF) shl 8) or (b[p + 3].toLong() and 0xFF)
    private fun u64(b: ByteArray, p: Int): Long = (u32(b, p) shl 32) or u32(b, p + 4)
    private fun u16(b: ByteArray, p: Int): Int = ((b[p].toInt() and 0xFF) shl 8) or (b[p + 1].toInt() and 0xFF)

    private fun kids(b: ByteArray, from: Int, to: Int): List<Box> {
        val out = ArrayList<Box>(); var p = from
        while (p + 8 <= to) {
            var sz = u32(b, p); val type = String(b, p + 4, 4, Charsets.ISO_8859_1); var hdr = 8
            if (sz == 1L) { if (p + 16 > to) break; sz = u64(b, p + 8); hdr = 16 } else if (sz == 0L) sz = (to - p).toLong()
            if (sz < hdr) break
            val end = minOf(to.toLong(), p + sz).toInt()
            out.add(Box(type, p + hdr, end))
            if (end <= p) break
            p = end
        }
        return out
    }
    private fun kid(b: ByteArray, parent: Box, type: String): Box? = kids(b, parent.s, parent.e).firstOrNull { it.type == type }

    /** Nero "chpl" chapter list (what ffmpeg, MP4Box and most tools write). */
    private fun parseChpl(b: ByteArray, c: Box): List<Chap> {
        val out = mutableListOf<Chap>()
        var p = c.s
        if (p + 5 > c.e) return out
        val ver = b[p].toInt() and 0xFF; p += 4
        if (ver == 1) p += 4
        if (p >= c.e) return out
        val n = b[p].toInt() and 0xFF; p++
        for (i in 0 until n) {
            if (p + 9 > c.e) break
            val start = u64(b, p) * 100L; p += 8
            val l = b[p].toInt() and 0xFF; p++
            if (p + l > c.e) break
            out.add(Chap(start, -1, String(b, p, l, Charsets.UTF_8))); p += l
        }
        return out
    }
    private fun chpl(b: ByteArray, moov: Box): List<Chap> {
        val udta = kid(b, moov, "udta") ?: return emptyList()
        val c = kid(b, udta, "chpl") ?: return emptyList()
        return parseChpl(b, c)
    }
    /** Last resort: some tools put the atom somewhere unusual, so look for its name anywhere in the movie box. */
    private fun chplScan(b: ByteArray): List<Chap> {
        var i = 4
        while (i + 4 < b.size) {
            if (b[i] == 'c'.code.toByte() && b[i + 1] == 'h'.code.toByte() && b[i + 2] == 'p'.code.toByte() && b[i + 3] == 'l'.code.toByte()) {
                val sz = u32(b, i - 4)
                if (sz in 13..1_000_000) { val r = parseChpl(b, Box("chpl", i + 4, minOf(b.size.toLong(), i - 4 + sz).toInt())); if (r.isNotEmpty()) return r }
            }
            i++
        }
        return emptyList()
    }

    /** QuickTime chapter track: a text track that the video track points to with tref/chap. */
    private fun qtTrack(raf: RandomAccessFile, b: ByteArray, moov: Box): List<Chap> {
        val out = mutableListOf<Chap>()
        val traks = kids(b, moov.s, moov.e).filter { it.type == "trak" }
        var wantId = -1L
        for (t in traks) { val ch = kid(b, t, "tref")?.let { kid(b, it, "chap") }; if (ch != null && ch.e - ch.s >= 4) { wantId = u32(b, ch.s); break } }
        if (wantId < 0) return out
        for (t in traks) {
            val tk = kid(b, t, "tkhd") ?: continue
            val id = if ((b[tk.s].toInt() and 0xFF) == 1) u32(b, tk.s + 20) else u32(b, tk.s + 12)
            if (id != wantId) continue
            val mdia = kid(b, t, "mdia") ?: return out
            val mdhd = kid(b, mdia, "mdhd") ?: return out
            val scale = (if ((b[mdhd.s].toInt() and 0xFF) == 1) u32(b, mdhd.s + 20) else u32(b, mdhd.s + 12)).toDouble()
            if (scale <= 0) return out
            val stbl = kid(b, kid(b, mdia, "minf") ?: return out, "stbl") ?: return out
            val stts = kid(b, stbl, "stts") ?: return out
            val stsz = kid(b, stbl, "stsz") ?: return out
            val stsc = kid(b, stbl, "stsc") ?: return out
            val co = kid(b, stbl, "stco"); val co64 = kid(b, stbl, "co64")
            if (co == null && co64 == null) return out
            // sample start times
            val times = ArrayList<Long>(); var tt = 0L
            run { val n = u32(b, stts.s + 4).toInt(); var p = stts.s + 8
                for (i in 0 until n) { if (p + 8 > stts.e) break; val c = u32(b, p).toInt(); val d = u32(b, p + 4); for (k in 0 until c) { if (times.size > 5000) break; times.add(tt); tt += d }; p += 8 } }
            // sample sizes
            val fixed = u32(b, stsz.s + 4); val cnt = minOf(times.size, u32(b, stsz.s + 8).toInt())
            val sizes = IntArray(cnt) { i -> if (fixed > 0) fixed.toInt() else u32(b, stsz.s + 12 + i * 4).toInt() }
            // sample offsets through the chunk table
            val chunkOffs = ArrayList<Long>()
            if (co != null) { val n = u32(b, co.s + 4).toInt(); for (i in 0 until minOf(n, 5000)) chunkOffs.add(u32(b, co.s + 8 + i * 4)) }
            else { val n = u32(b, co64!!.s + 4).toInt(); for (i in 0 until minOf(n, 5000)) chunkOffs.add(u64(b, co64.s + 8 + i * 8)) }
            val nsc = u32(b, stsc.s + 4).toInt()
            val first = IntArray(nsc); val per = IntArray(nsc)
            for (i in 0 until nsc) { first[i] = u32(b, stsc.s + 8 + i * 12).toInt(); per[i] = u32(b, stsc.s + 12 + i * 12).toInt() }
            var si = 0
            for (ci in chunkOffs.indices) {
                var k = nsc - 1; while (k > 0 && first[k] > ci + 1) k--
                var off = chunkOffs[ci]
                for (j in 0 until (if (nsc > 0) per[k] else 0)) {
                    if (si >= cnt) break
                    if (sizes[si] >= 2) {
                        raf.seek(off); val sb = ByteArray(minOf(sizes[si], 400)); raf.readFully(sb)
                        val l = minOf(u16(sb, 0), sb.size - 2)
                        out.add(Chap((times[si] / scale * 1e9).toLong(), -1, String(sb, 2, l, Charsets.UTF_8).trim('\u0000', ' ')))
                    }
                    off += sizes[si]; si++
                }
            }
            return out
        }
        return out
    }

    @Volatile private var how = ""
    /** Short note about the last file checked, shown in Settings > App info (helps when a file shows no chapters). */
    @Volatile var lastDebug = ""

    private fun sniff(f: File): String {
        try { RandomAccessFile(f, "r").use { r ->
            val h = ByteArray(12); val n = r.read(h); if (n < 8) return ""
            if ((h[0].toInt() and 0xFF) == 0x1A && (h[1].toInt() and 0xFF) == 0x45 && (h[2].toInt() and 0xFF) == 0xDF && (h[3].toInt() and 0xFF) == 0xA3) return "mkv"
            if (String(h, 4, 4, Charsets.ISO_8859_1) in setOf("ftyp", "moov", "mdat", "free", "wide", "skip")) return "mp4"
        } } catch (e: Exception) { }
        return ""
    }

    private fun findMp4(f: File): List<Chap> {
        RandomAccessFile(f, "r").use { raf ->
            var pos = 0L; var guard = 0
            while (pos + 8 <= raf.length() && guard++ < 64) {
                raf.seek(pos)
                val h = ByteArray(16); raf.read(h, 0, 8)
                var sz = u32(h, 0); val type = String(h, 4, 4, Charsets.ISO_8859_1); var hdr = 8L
                if (sz == 1L) { raf.readFully(h, 8, 8); sz = u64(h, 8); hdr = 16 } else if (sz == 0L) sz = raf.length() - pos
                if (sz < hdr) break
                if (type == "moov") {
                    val len = sz - hdr
                    if (len <= 0 || len > 40_000_000) return emptyList()
                    val b = ByteArray(len.toInt()); raf.seek(pos + hdr); raf.readFully(b)
                    val moov = Box("moov", 0, b.size)
                    val a = chpl(b, moov)
                    if (a.isNotEmpty()) { how = "chpl"; return a }
                    val q = try { qtTrack(raf, b, moov) } catch (e: Exception) { emptyList() }
                    if (q.isNotEmpty()) { how = "text track"; return q }
                    val sc = chplScan(b)
                    if (sc.isNotEmpty()) how = "chpl (scan)"
                    return sc
                }
                pos += sz
            }
        }
        return emptyList()
    }

    /** Chapters as [{start, end, title}] in seconds, named "1 • Opening" etc.; empty when the file has none. */
    fun read(f: File, durationSec: Double): JSONArray {
        val out = JSONArray()
        try {
            val ext = f.extension.lowercase()
            var kind = sniff(f)
            if (kind.isEmpty()) kind = when (ext) { "mkv", "webm", "mka" -> "mkv"; "mp4", "m4v", "mov", "m4a", "3gp" -> "mp4"; else -> "" }
            how = if (kind == "mkv") "matroska" else ""
            if (kind.isEmpty()) { lastDebug = f.name + ": no chapters in this file type"; return out }
            val list = (if (kind == "mkv") find(f) else findMp4(f)).sortedBy { it.startNs }
            lastDebug = f.name + " (" + kind + "): " + (if (list.isEmpty()) "no chapters found" else list.size.toString() + " chapters via " + how)
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
        } catch (e: Exception) { lastDebug = f.name + ": chapter read failed (" + (e.message ?: e.javaClass.simpleName) + ")" }
        return out
    }
}
