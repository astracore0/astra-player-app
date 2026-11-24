package com.astracore.astraplayer

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest

/**
 * Online mode pictures (no account or key needed): the best match from
 *  - AniList   (anime),
 *  - TVMaze    (TV shows, web series),
 *  - iTunes    (movies),
 * plus YouTube thumbnails for videos saved with their id in the name, e.g. "Title [dQw4w9WgXcQ].mp4".
 * Every lookup is cached on the phone, so the network is used once per title.
 */
class OnlineMeta(private val dir: File) {
    init { dir.mkdirs() }

    private class Hit(val title: String, val url: String, val synopsis: String, val score: Double, val rank: Int, val source: String)

    private fun sha1(s: String) = MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun get(u: String, post: String? = null, ct: String = "application/json"): String? = try {
        val c = URL(u).openConnection() as HttpURLConnection
        c.connectTimeout = 10000; c.readTimeout = 12000
        c.setRequestProperty("User-Agent", "AstraPlayer/2.10 (Android)"); c.setRequestProperty("Accept", "application/json")
        if (post != null) { c.requestMethod = "POST"; c.doOutput = true; c.setRequestProperty("Content-Type", ct); c.outputStream.use { it.write(post.toByteArray()) } }
        if (c.responseCode in 200..299) c.inputStream.bufferedReader().readText() else null
    } catch (e: Exception) { null }

    private fun words(x: String): List<String> = x.lowercase().replace(Regex("[^\\p{L}\\p{N}]+"), " ").trim().split(" ").filter { it.isNotEmpty() && !Regex("(19|20)\\d\\d").matches(it) }
    private fun sim(want: String, cand: String?): Double {
        if (cand.isNullOrBlank()) return 0.0
        val a = words(want).toSet(); val b = words(cand).toSet()
        if (a.isEmpty() || b.isEmpty()) return 0.0
        if (a == b) return 1.0
        return a.count { it in b }.toDouble() / maxOf(a.size, b.size)
    }
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    private fun anilist(q: String, big: Boolean): Hit? {
        val gql = "query (\$s: String) { Page(perPage: 8) { media(search: \$s, type: ANIME, sort: SEARCH_MATCH) { format title { english romaji native } synonyms coverImage { extraLarge large medium } description(asHtml: false) } } }"
        val body = JSONObject().put("query", gql).put("variables", JSONObject().put("s", q)).toString()
        val txt = get("https://graphql.anilist.co", body) ?: return null
        val list = JSONObject(txt).optJSONObject("data")?.optJSONObject("Page")?.optJSONArray("media") ?: return null
        var best: Hit? = null
        for (i in 0 until list.length()) {
            val m = list.getJSONObject(i); val t = m.optJSONObject("title") ?: continue
            var sc = 0.0
            val names = mutableListOf(t.optString("english"), t.optString("romaji"), t.optString("native"))
            m.optJSONArray("synonyms")?.let { for (j in 0 until it.length()) names.add(it.optString(j)) }
            names.forEach { sc = maxOf(sc, sim(q, it)) }
            if (m.optString("format") == "TV") sc += 0.05
            val ci = m.optJSONObject("coverImage") ?: continue
            val u = (if (big) ci.optString("extraLarge").ifEmpty { ci.optString("large") } else ci.optString("large").ifEmpty { ci.optString("medium") })
            if (u.isEmpty()) continue
            if (best == null || sc > best.score) best = Hit(t.optString("english").ifEmpty { t.optString("romaji") }.ifEmpty { q }, u, m.optString("description").replace(Regex("<[^>]+>"), "").take(260), sc, 0, "AniList")
        }
        return best
    }

    private fun tvmaze(q: String, big: Boolean): Hit? {
        val txt = get("https://api.tvmaze.com/search/shows?q=" + enc(q)) ?: return null
        val arr = JSONArray(txt); var best: Hit? = null
        for (i in 0 until arr.length()) {
            val s = arr.getJSONObject(i).optJSONObject("show") ?: continue
            val img = s.optJSONObject("image") ?: continue
            val u = if (big) img.optString("original") else img.optString("medium").ifEmpty { img.optString("original") }
            if (u.isEmpty()) continue
            val sc = sim(q, s.optString("name"))
            if (best == null || sc > best.score) best = Hit(s.optString("name"), u.replace("http://", "https://"), s.optString("summary").replace(Regex("<[^>]+>"), "").take(260), sc, 1, "TVMaze")
        }
        return best
    }

    private fun itunes(q: String, big: Boolean): Hit? {
        val txt = get("https://itunes.apple.com/search?media=movie&entity=movie&limit=8&term=" + enc(q)) ?: return null
        val arr = JSONObject(txt).optJSONArray("results") ?: return null; var best: Hit? = null
        for (i in 0 until arr.length()) {
            val m = arr.getJSONObject(i)
            val a = m.optString("artworkUrl100"); if (a.isEmpty()) continue
            val sc = sim(q, m.optString("trackName"))
            val u = a.replace("100x100bb", if (big) "600x900bb" else "400x600bb")
            if (best == null || sc > best.score) best = Hit(m.optString("trackName"), u, m.optString("longDescription").take(260), sc, 2, "iTunes")
        }
        return best
    }

    /** Series / movie cover for a cleaned title. Result shape matches the server version of this endpoint. */
    fun lookup(rawTitle: String, hq: Boolean): JSONObject {
        val clean = rawTitle.trim()
        if (clean.isEmpty()) return JSONObject().put("found", false)
        val slug = sha1("${clean.lowercase()}|${if (hq) "480p" else "360p"}|v3")
        val meta = File(dir, "$slug.json"); val img = File(dir, "$slug.jpg")
        try { if (meta.isFile && img.isFile) return JSONObject(meta.readText()).put("localUrl", "/api/meta/online/img?slug=$slug") } catch (e: Exception) {}
        val res = arrayOfNulls<Hit>(3)
        val ts = listOf(
            Thread { res[0] = try { anilist(clean, hq) } catch (e: Exception) { null } },
            Thread { res[1] = try { tvmaze(clean, hq) } catch (e: Exception) { null } },
            Thread { res[2] = try { itunes(clean, hq) } catch (e: Exception) { null } })
        ts.forEach { it.start() }; ts.forEach { try { it.join(15000) } catch (e: Exception) {} }
        // a wrong picture is worse than none: needs at least half of the words to match
        val hit = res.filterNotNull().filter { it.score >= 0.5 }.sortedWith(compareBy({ -it.score }, { it.rank })).firstOrNull()
            ?: return JSONObject().put("found", false).put("title", clean).put("error", "No picture found for \"$clean\"")
        val bytes = try {
            val c = URL(hit.url).openConnection() as HttpURLConnection
            c.connectTimeout = 10000; c.readTimeout = 15000; c.setRequestProperty("User-Agent", "AstraPlayer/2.10 (Android)")
            if (c.responseCode in 200..299) c.inputStream.readBytes() else null
        } catch (e: Exception) { null } ?: return JSONObject().put("found", false).put("title", clean).put("error", "Could not download the picture (check internet)")
        img.writeBytes(bytes)
        val out = JSONObject().put("found", true).put("title", hit.title).put("synopsis", hit.synopsis).put("source", hit.source).put("quality", if (hq) "480p" else "360p")
        meta.writeText(out.toString())
        return out.put("localUrl", "/api/meta/online/img?slug=$slug")
    }

    fun image(slug: String): ByteArray? {
        if (!Regex("[0-9a-f]{40}").matches(slug)) return null
        val f = File(dir, "$slug.jpg"); return if (f.isFile) f.readBytes() else null
    }

    /** YouTube picture for a file named "... [VIDEOID].ext" (as saved by yt-dlp). Null when the name has no id or there is no internet. */
    fun youtube(fileName: String): ByteArray? {
        val id = Regex("\\[([A-Za-z0-9_-]{11})\\]").findAll(fileName).lastOrNull()?.groupValues?.get(1) ?: return null
        val f = File(dir, "yt_$id.jpg"); if (f.isFile) return f.readBytes()
        for (n in listOf("maxresdefault", "hqdefault")) {
            try {
                val c = URL("https://img.youtube.com/vi/$id/$n.jpg").openConnection() as HttpURLConnection
                c.connectTimeout = 8000; c.readTimeout = 10000
                if (c.responseCode == 200) { val b = c.inputStream.readBytes(); if (b.size > 2000) { f.writeBytes(b); return b } }
            } catch (e: Exception) {}
        }
        return null
    }
}
