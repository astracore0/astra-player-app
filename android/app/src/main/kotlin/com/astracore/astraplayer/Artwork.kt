package com.astracore.astraplayer

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest

/**
 * Online mode covers. Looks the title up on several free services that need no key, in this order:
 * AniList (anime), TVmaze (series / web series), iTunes (movies), Wikipedia (anything else with a poster),
 * and YouTube's own thumbnail for files that carry a YouTube id. A result is only accepted when its title
 * really looks like the one asked for, so a movie never gets some random anime's cover.
 */
object Artwork {
    private const val UA = "AstraPlayer/2 (Android media player)"
    private fun dir(ctx: Context) = File(ctx.externalCacheDir ?: ctx.cacheDir, "online_meta").also { it.mkdirs() }
    private fun sha(s: String) = MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }.take(20)

    private fun get(url: String, post: String? = null, accept: String = "application/json"): ByteArray? {
        return try {
            val c = URL(url).openConnection() as HttpURLConnection
            c.connectTimeout = 10000; c.readTimeout = 15000
            c.setRequestProperty("User-Agent", UA); c.setRequestProperty("Accept", accept)
            if (post != null) { c.requestMethod = "POST"; c.doOutput = true; c.setRequestProperty("Content-Type", "application/json"); c.outputStream.use { it.write(post.toByteArray()) } }
            if (c.responseCode !in 200..299) null else c.inputStream.use { it.readBytes() }
        } catch (e: Exception) { null }
    }
    private fun getText(url: String, post: String? = null) = get(url, post)?.toString(Charsets.UTF_8)
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    private fun norm(s: String) = s.lowercase().replace(Regex("\\(.*?\\)|\\[.*?]"), " ").replace(Regex("[^\\p{L}\\p{N}]+"), " ").trim()
    /** 0..1: how much two titles look alike (shared words, or one inside the other). */
    private fun sim(a: String, b: String): Double {
        val x = norm(a); val y = norm(b)
        if (x.isEmpty() || y.isEmpty()) return 0.0
        if (x == y) return 1.0
        if (x.length >= 5 && y.length >= 5 && (x.contains(y) || y.contains(x))) return 0.85
        val sa = x.split(' ').toSet(); val sb = y.split(' ').toSet()
        return sa.intersect(sb).size.toDouble() / maxOf(sa.size, sb.size)
    }
    private fun best(q: String, names: List<String>) = names.filter { it.isNotBlank() }.maxOfOrNull { sim(q, it) } ?: 0.0

    private class Hit(val title: String, val url: String, val synopsis: String)

    private fun anilist(t: String, big: Boolean): Hit? {
        val body = JSONObject().put("query", "query(\$s:String){Page(perPage:6){media(search:\$s,type:ANIME,sort:SEARCH_MATCH){title{romaji english native} synonyms coverImage{large extraLarge} description(asHtml:false)}}}")
            .put("variables", JSONObject().put("s", t)).toString()
        val arr = try { JSONObject(getText("https://graphql.anilist.co", body) ?: return null).getJSONObject("data").getJSONObject("Page").getJSONArray("media") } catch (e: Exception) { return null }
        var top: Hit? = null; var ts = 0.0
        for (i in 0 until arr.length()) {
            val m = arr.getJSONObject(i); val ti = m.optJSONObject("title") ?: continue
            val names = ArrayList<String>(); for (k in listOf("romaji", "english", "native")) names.add(ti.optString(k))
            m.optJSONArray("synonyms")?.let { for (j in 0 until it.length()) names.add(it.optString(j)) }
            val s = best(t, names); val ci = m.optJSONObject("coverImage") ?: continue
            val u = (if (big) ci.optString("extraLarge") else "").ifEmpty { ci.optString("large") }
            if (s > ts && u.isNotEmpty()) { ts = s; top = Hit(ti.optString("english").ifEmpty { ti.optString("romaji") }, u, m.optString("description").replace(Regex("<[^>]*>"), "")) }
        }
        return if (ts >= 0.6) top else null
    }

    private fun tvmaze(t: String, big: Boolean): Hit? {
        val arr = try { JSONArray(getText("https://api.tvmaze.com/search/shows?q=" + enc(t)) ?: return null) } catch (e: Exception) { return null }
        var top: Hit? = null; var ts = 0.0
        for (i in 0 until arr.length()) {
            val sh = arr.getJSONObject(i).optJSONObject("show") ?: continue
            val img = sh.optJSONObject("image") ?: continue
            val u = (if (big) img.optString("original") else "").ifEmpty { img.optString("medium") }
            val s = sim(t, sh.optString("name"))
            if (s > ts && u.isNotEmpty()) { ts = s; top = Hit(sh.optString("name"), u, sh.optString("summary").replace(Regex("<[^>]*>"), "")) }
        }
        return if (ts >= 0.7) top else null
    }

    private fun itunes(t: String, big: Boolean): Hit? {
        val arr = try { JSONObject(getText("https://itunes.apple.com/search?media=movie&entity=movie&limit=6&term=" + enc(t)) ?: return null).getJSONArray("results") } catch (e: Exception) { return null }
        var top: Hit? = null; var ts = 0.0
        for (i in 0 until arr.length()) {
            val m = arr.getJSONObject(i); val u = m.optString("artworkUrl100"); if (u.isEmpty()) continue
            val s = sim(t, m.optString("trackName"))
            if (s > ts) { ts = s; val n = if (big) 1000 else 600; top = Hit(m.optString("trackName"), u.replace("100x100bb", "${n}x${n}bb"), m.optString("longDescription")) }
        }
        return if (ts >= 0.7) top else null
    }

    private fun wikipedia(t: String, big: Boolean): Hit? {
        val px = if (big) 900 else 500
        val j = try { JSONObject(getText("https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=4&gsrsearch=" + enc("$t (film OR series OR anime OR show)") +
            "&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=$px&exintro=1&explaintext=1&exlimit=max") ?: return null).getJSONObject("query").getJSONObject("pages") } catch (e: Exception) { return null }
        var top: Hit? = null; var ts = 0.0
        for (k in j.keys()) {
            val p = j.getJSONObject(k); val u = p.optJSONObject("thumbnail")?.optString("source") ?: continue
            val s = sim(t, p.optString("title"))
            if (s > ts) { ts = s; top = Hit(p.optString("title").replace(Regex("\\s*\\(.*\\)$"), ""), u, p.optString("extract")) }
        }
        return if (ts >= 0.7) top else null
    }

    /** YouTube files usually carry their id like "Title [dQw4w9WgXcQ].mp4". */
    fun ytId(name: String): String? = Regex("\\[([A-Za-z0-9_-]{11})]").find(name)?.groupValues?.get(1)

    fun ytThumb(ctx: Context, id: String): ByteArray? {
        val f = File(dir(ctx), "yt_$id.jpg")
        if (f.exists() && f.length() > 500) return f.readBytes()
        for (n in listOf("maxresdefault", "hqdefault")) {
            val b = get("https://i.ytimg.com/vi/$id/$n.jpg", accept = "image/*")
            if (b != null && b.size > 2500) { try { f.writeBytes(b) } catch (e: Exception) {}; return b }
        }
        return null
    }

    fun find(ctx: Context, title: String, q: String): Pair<Int, String> {
        val t = title.trim()
        if (t.isEmpty()) return Pair(200, JSONObject().put("found", false).toString())
        val big = q == "720p" || q == "1080p"
        val slug = sha("${t.lowercase()}|${if (big) "big" else "small"}|v3")
        val meta = File(dir(ctx), "$slug.json"); val img = File(dir(ctx), "$slug.jpg")
        try {
            if (meta.exists()) {
                val c = JSONObject(meta.readText())
                if (c.optBoolean("found") && img.exists()) return Pair(200, c.put("localUrl", "/api/meta/online/img?slug=$slug").toString())
                if (!c.optBoolean("found") && System.currentTimeMillis() - c.optLong("at") < 86400000L) return Pair(200, c.toString())
            }
        } catch (e: Exception) {}
        val ytid = ytId(t)
        val hit: Hit? = if (ytid != null) null else listOf<(String, Boolean) -> Hit?>(::anilist, ::tvmaze, ::itunes, ::wikipedia).firstNotNullOfOrNull { it(t, big) }
        if (hit == null) {
            val miss = JSONObject().put("found", false).put("title", t).put("at", System.currentTimeMillis()).put("error", "No cover found for \"$t\"")
            try { meta.writeText(miss.toString()) } catch (e: Exception) {}
            return Pair(200, miss.toString())
        }
        val bytes = get(hit.url, accept = "image/*")
        if (bytes == null || bytes.size < 1500) return Pair(200, JSONObject().put("found", false).put("title", t).put("error", "Cover download failed").toString())
        img.writeBytes(bytes)
        val out = JSONObject().put("found", true).put("title", hit.title).put("synopsis", hit.synopsis.take(600)).put("quality", q)
        meta.writeText(out.toString())
        return Pair(200, out.put("localUrl", "/api/meta/online/img?slug=$slug").toString())
    }

    fun img(ctx: Context, slug: String): ByteArray? {
        if (!Regex("^[0-9a-f]{20}$").matches(slug)) return null
        val f = File(dir(ctx), "$slug.jpg"); return if (f.exists()) f.readBytes() else null
    }
    fun mime(b: ByteArray) = if (b.size > 4 && b[0] == 0x89.toByte() && b[1] == 'P'.code.toByte()) "image/png" else "image/jpeg"
}
