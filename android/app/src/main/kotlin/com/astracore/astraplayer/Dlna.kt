package com.astracore.astraplayer

import android.content.Context
import android.net.wifi.WifiManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.net.URL
import java.util.UUID

/**
 * Cast to a TV over DLNA / UPnP (most smart TVs, Android TV with a DLNA renderer, BubbleUPnP, VLC...).
 * The phone serves the video file over HTTP on the local network and tells the TV to play that address.
 * Chromecast is a different protocol and is not covered here.
 */
object Dlna {
    class Dev(val name: String, val control: String)

    @Volatile private var devs: List<Dev> = emptyList()
    @Volatile private var current: Dev? = null
    private var server: ServerSocket? = null
    private val files = HashMap<String, File>()

    private fun esc(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")

    fun discover(ctx: Context): JSONArray {
        val wifi = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        val lock = try { wifi?.createMulticastLock("astra-dlna")?.also { it.setReferenceCounted(false); it.acquire() } } catch (e: Exception) { null }
        val locations = LinkedHashSet<String>()
        try {
            val s = DatagramSocket(); s.soTimeout = 700
            val msg = "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: urn:schemas-upnp-org:service:AVTransport:1\r\n\r\n".toByteArray()
            val grp = InetAddress.getByName("239.255.255.250")
            repeat(2) { s.send(DatagramPacket(msg, msg.size, grp, 1900)) }
            val end = System.currentTimeMillis() + 3200
            val buf = ByteArray(4096)
            while (System.currentTimeMillis() < end) {
                try {
                    val p = DatagramPacket(buf, buf.size); s.receive(p)
                    val txt = String(p.data, 0, p.length)
                    Regex("(?im)^location:\\s*(\\S+)").find(txt)?.let { locations.add(it.groupValues[1]) }
                } catch (e: SocketTimeoutException) { }
            }
            s.close()
        } catch (e: Exception) { } finally { try { lock?.release() } catch (e: Exception) { } }
        val out = ArrayList<Dev>()
        for (loc in locations) {
            try {
                val c = URL(loc).openConnection() as java.net.HttpURLConnection
                c.connectTimeout = 2000; c.readTimeout = 2500
                val xml = c.inputStream.bufferedReader().readText()
                val name = Regex("<friendlyName>(.*?)</friendlyName>", RegexOption.DOT_MATCHES_ALL).find(xml)?.groupValues?.get(1)?.trim() ?: continue
                val ctl = Regex("<service>(?:(?!</service>).)*?AVTransport(?:(?!</service>).)*?<controlURL>([^<]+)</controlURL>", RegexOption.DOT_MATCHES_ALL).find(xml)?.groupValues?.get(1)?.trim() ?: continue
                if (out.none { it.name == name }) out.add(Dev(name, URL(URL(loc), ctl).toString()))
            } catch (e: Exception) { }
        }
        devs = out
        val arr = JSONArray(); out.forEachIndexed { i, d -> arr.put(JSONObject().put("id", i).put("name", d.name)) }
        return arr
    }

    private fun soap(d: Dev, action: String, args: String): String? {
        return try {
            val body = "<?xml version=\"1.0\"?><s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\"><s:Body><u:$action xmlns:u=\"urn:schemas-upnp-org:service:AVTransport:1\"><InstanceID>0</InstanceID>$args</u:$action></s:Body></s:Envelope>"
            val c = URL(d.control).openConnection() as java.net.HttpURLConnection
            c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 3000; c.readTimeout = 5000
            c.setRequestProperty("Content-Type", "text/xml; charset=\"utf-8\"")
            c.setRequestProperty("SOAPACTION", "\"urn:schemas-upnp-org:service:AVTransport:1#$action\"")
            c.outputStream.use { it.write(body.toByteArray()) }
            if (c.responseCode in 200..299) c.inputStream.bufferedReader().readText() else { try { c.errorStream?.close() } catch (e: Exception) { }; null }
        } catch (e: Exception) { null }
    }

    private fun localIp(): String? {
        var best: String? = null
        try {
            for (ni in NetworkInterface.getNetworkInterfaces()) {
                if (!ni.isUp || ni.isLoopback) continue
                for (a in ni.inetAddresses) if (a is Inet4Address && a.isSiteLocalAddress) { if (best == null || ni.name.startsWith("wlan") || ni.name.startsWith("ap")) best = a.hostAddress }
            }
        } catch (e: Exception) { }
        return best
    }

    private fun mime(n: String) = when (n.substringAfterLast('.', "").lowercase()) {
        "mp4", "m4v" -> "video/mp4"; "mkv" -> "video/x-matroska"; "webm" -> "video/webm"; "avi" -> "video/x-msvideo"
        "mov" -> "video/quicktime"; "ts" -> "video/mp2t"; "mp3" -> "audio/mpeg"; "m4a" -> "audio/mp4"; else -> "video/mp4"
    }

    private fun hms(sec: Int) = "%d:%02d:%02d".format(sec / 3600, sec / 60 % 60, sec % 60)
    private fun parseHms(s: String?): Int { val p = s?.split(':') ?: return 0; if (p.size != 3) return 0; return (p[0].toIntOrNull() ?: 0) * 3600 + (p[1].toIntOrNull() ?: 0) * 60 + (p[2].substringBefore('.').toIntOrNull() ?: 0) }

    @Synchronized private fun ensureServer(): ServerSocket {
        server?.let { if (!it.isClosed) return it }
        val ss = ServerSocket(0); server = ss
        Thread { while (!ss.isClosed) { try { val s = ss.accept(); Thread { serve(s) }.start() } catch (e: Exception) { } } }.start()
        return ss
    }

    private fun serve(s: Socket) {
        try {
            s.soTimeout = 30000
            val inp: InputStream = s.getInputStream(); val out: OutputStream = s.getOutputStream()
            val br = inp.bufferedReader(Charsets.ISO_8859_1)
            val first = br.readLine() ?: return
            val parts = first.split(' '); if (parts.size < 2) return
            var range: String? = null
            while (true) { val l = br.readLine() ?: break; if (l.isEmpty()) break; if (l.lowercase().startsWith("range:")) range = l.substringAfter(':').trim() }
            val token = parts[1].removePrefix("/m/").substringBefore('/').substringBefore('?')
            val f = synchronized(files) { files[token] }
            if (f == null || !f.isFile) { out.write("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n".toByteArray()); out.flush(); return }
            val len = f.length(); var start = 0L; var end = len - 1
            range?.let { Regex("bytes=(\\d*)-(\\d*)").find(it)?.let { m ->
                if (m.groupValues[1].isNotEmpty()) { start = m.groupValues[1].toLong(); if (m.groupValues[2].isNotEmpty()) end = minOf(end, m.groupValues[2].toLong()) }
                else if (m.groupValues[2].isNotEmpty()) { start = maxOf(0, len - m.groupValues[2].toLong()) }
            } }
            if (start > end || start >= len) { out.write("HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */$len\r\nContent-Length: 0\r\n\r\n".toByteArray()); out.flush(); return }
            val partial = range != null
            val h = StringBuilder(if (partial) "HTTP/1.1 206 Partial Content\r\n" else "HTTP/1.1 200 OK\r\n")
            h.append("Content-Type: ").append(mime(f.name)).append("\r\nAccept-Ranges: bytes\r\nContent-Length: ").append(end - start + 1).append("\r\n")
            if (partial) h.append("Content-Range: bytes $start-$end/$len\r\n")
            h.append("transferMode.dlna.org: Streaming\r\ncontentFeatures.dlna.org: DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000\r\nConnection: close\r\n\r\n")
            out.write(h.toString().toByteArray())
            if (parts[0] != "HEAD") {
                java.io.RandomAccessFile(f, "r").use { raf ->
                    raf.seek(start); var left = end - start + 1; val buf = ByteArray(64 * 1024)
                    while (left > 0) { val n = raf.read(buf, 0, minOf(buf.size.toLong(), left).toInt()); if (n < 0) break; out.write(buf, 0, n); left -= n }
                }
            }
            out.flush()
        } catch (e: Exception) { } finally { try { s.close() } catch (e: Exception) { } }
    }

    fun play(id: Int, f: File, title: String, startSec: Int): JSONObject {
        val d = devs.getOrNull(id) ?: return JSONObject().put("ok", false).put("error", "Scan for TVs first")
        val ip = localIp() ?: return JSONObject().put("ok", false).put("error", "Connect to Wi-Fi (or turn on the hotspot) first")
        val ss = ensureServer()
        val token = UUID.randomUUID().toString().replace("-", "").take(16)
        synchronized(files) { files.clear(); files[token] = f }
        val url = "http://$ip:${ss.localPort}/m/$token/" + java.net.URLEncoder.encode(f.name, "UTF-8").replace("+", "%20")
        val didl = "<DIDL-Lite xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\"><item id=\"0\" parentID=\"-1\" restricted=\"1\"><dc:title>${esc(title)}</dc:title><upnp:class>object.item.videoItem</upnp:class><res protocolInfo=\"http-get:*:${mime(f.name)}:*\">${esc(url)}</res></item></DIDL-Lite>"
        soap(d, "Stop", "")
        if (soap(d, "SetAVTransportURI", "<CurrentURI>${esc(url)}</CurrentURI><CurrentURIMetaData>${esc(didl)}</CurrentURIMetaData>") == null)
            return JSONObject().put("ok", false).put("error", "The TV did not accept the video")
        soap(d, "Play", "<Speed>1</Speed>")
        current = d
        if (startSec > 3) Thread { for (i in 0 until 6) { Thread.sleep(1200); if (soap(d, "Seek", "<Unit>REL_TIME</Unit><Target>${hms(startSec)}</Target>") != null) break } }.start()
        return JSONObject().put("ok", true).put("name", d.name)
    }

    fun ctl(action: String, pos: Int): JSONObject {
        val d = current ?: return JSONObject().put("ok", false)
        when (action) {
            "pause" -> soap(d, "Pause", "")
            "play" -> soap(d, "Play", "<Speed>1</Speed>")
            "seek" -> soap(d, "Seek", "<Unit>REL_TIME</Unit><Target>${hms(maxOf(0, pos))}</Target>")
            "stop" -> { soap(d, "Stop", ""); current = null; synchronized(files) { files.clear() }; try { server?.close() } catch (e: Exception) { }; server = null }
        }
        return JSONObject().put("ok", true)
    }

    fun status(): JSONObject {
        val d = current ?: return JSONObject().put("active", false)
        val pi = soap(d, "GetPositionInfo", "")
        val ti = soap(d, "GetTransportInfo", "")
        val pos = parseHms(pi?.let { Regex("<RelTime>(.*?)</RelTime>").find(it)?.groupValues?.get(1) })
        val dur = parseHms(pi?.let { Regex("<TrackDuration>(.*?)</TrackDuration>").find(it)?.groupValues?.get(1) })
        val st = ti?.let { Regex("<CurrentTransportState>(.*?)</CurrentTransportState>").find(it)?.groupValues?.get(1) } ?: "UNKNOWN"
        return JSONObject().put("active", true).put("name", d.name).put("pos", pos).put("dur", dur).put("state", st)
    }
}
