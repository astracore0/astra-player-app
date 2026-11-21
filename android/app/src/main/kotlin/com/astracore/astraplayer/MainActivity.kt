package com.astracore.astraplayer

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.view.LayoutInflater
import android.view.TextureView
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.C
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import io.github.anilbeesetti.nextlib.media3ext.ffdecoder.NextRenderersFactory
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var playerView: PlayerView
    private lateinit var api: Api
    private var player: ExoPlayer? = null
    private var metaSent = false
    private var pendingAudio = 0
    private val audioFx = AudioFx()
    private var filt = floatArrayOf(100f, 100f, 100f, 0f, 0f)
    private var needReload = false
    private val ui = Handler(Looper.getMainLooper())
    private val pool = Executors.newFixedThreadPool(3)
    private val host = "https://appassets.androidplatform.net"

    private val ticker = object : Runnable {
        override fun run() {
            val p = player
            if (p != null && p.isPlaying) js("window.__astraState&&window.__astraState(${stateJson()})")
            ui.postDelayed(this, 250)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        api = Api(this)

        val rootView = FrameLayout(this)
        rootView.setBackgroundColor(Color.BLACK)
        // A TextureView surface (not SurfaceView) so colour filters can be applied to the picture with a GPU colour matrix.
        playerView = LayoutInflater.from(this).inflate(R.layout.player_view, rootView, false) as PlayerView
        rootView.addView(playerView, FrameLayout.LayoutParams(-1, -1))

        web = WebView(this)
        web.setBackgroundColor(Color.TRANSPARENT)
        rootView.addView(web, FrameLayout.LayoutParams(-1, -1))
        setContentView(rootView)

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = false
        s.allowFileAccess = false
        web.webChromeClient = WebChromeClient()
        web.addJavascriptInterface(Bridge(), "AstraNative")
        val shim = assets.open("native-shim.js").bufferedReader().use { r -> r.readText() }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val u = request.url
                if (u.path == "/api/thumb") {
                    val bytes = api.thumb(u.getQueryParameter("file") ?: "")
                    return if (bytes != null) WebResourceResponse("image/jpeg", null, ByteArrayInputStream(bytes))
                    else WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                }
                return loader.shouldInterceptRequest(u)
            }
            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) view.evaluateJavascript(shim, null)
            }
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, shim, setOf(host))
        }
        web.loadUrl("$host/assets/www/index.html")
        ui.post(ticker)
        askStorage()
    }

    private fun hasStorage(): Boolean =
        if (Build.VERSION.SDK_INT >= 30) Environment.isExternalStorageManager()
        else checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == android.content.pm.PackageManager.PERMISSION_GRANTED

    private fun askStorage() {
        if (hasStorage()) return
        needReload = true
        if (Build.VERSION.SDK_INT >= 30) {
            try { startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:$packageName"))) }
            catch (e: Exception) { startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)) }
        } else requestPermissions(arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE), 1)
    }

    override fun onRequestPermissionsResult(code: Int, perms: Array<out String>, res: IntArray) {
        if (hasStorage() && needReload) { needReload = false; web.reload() }
    }

    override fun onResume() {
        super.onResume()
        hideBars()
        if (needReload && hasStorage()) { needReload = false; web.reload() }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideBars()
    }

    @Suppress("DEPRECATION")
    private fun hideBars() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onPause() {
        super.onPause()
        player?.playWhenReady = false
    }

    override fun onDestroy() {
        ui.removeCallbacks(ticker)
        audioFx.release()
        player?.release()
        player = null
        web.destroy()
        super.onDestroy()
    }

    // ---------- player ----------
    private fun js(code: String) { ui.post { web.evaluateJavascript(code, null) } }

    private fun stateJson(): String {
        val p = player ?: return "{}"
        val o = JSONObject()
        o.put("t", p.currentPosition / 1000.0)
        o.put("d", if (p.duration == C.TIME_UNSET) 0.0 else p.duration / 1000.0)
        o.put("b", p.bufferedPosition / 1000.0)
        o.put("w", p.videoSize.width)
        o.put("h", p.videoSize.height)
        o.put("paused", !p.playWhenReady)
        o.put("ended", p.playbackState == Player.STATE_ENDED)
        return o.toString()
    }

    private fun evt(name: String) { js("window.__astraEvt&&window.__astraEvt('$name',${stateJson()})") }

    private fun ensurePlayer(): ExoPlayer {
        player?.let { return it }
        // Hardware decoders first; the bundled FFmpeg takes over when the phone's chip can't decode the stream (e.g. 10-bit HEVC).
        val rf = NextRenderersFactory(this)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)
            .setEnableDecoderFallback(true)
        val p = ExoPlayer.Builder(this, rf).build()
        p.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_BUFFERING -> evt("waiting")
                    Player.STATE_READY -> { if (!metaSent) { metaSent = true; evt("loadedmetadata") }; evt("canplay") }
                    Player.STATE_ENDED -> evt("ended")
                }
            }
            override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) { evt(if (playWhenReady) "play" else "pause") }
            override fun onIsPlayingChanged(isPlaying: Boolean) { if (isPlaying) evt("playing") }
            override fun onPositionDiscontinuity(o: Player.PositionInfo, n: Player.PositionInfo, reason: Int) {
                if (reason == Player.DISCONTINUITY_REASON_SEEK) evt("seeked")
            }
            override fun onAudioSessionIdChanged(audioSessionId: Int) { audioFx.attach(audioSessionId) }
            override fun onTracksChanged(tracks: Tracks) { selectAudio(pendingAudio) }
            override fun onVideoSizeChanged(v: androidx.media3.common.VideoSize) { evt("resize") }
            override fun onPlayerError(e: androidx.media3.common.PlaybackException) { evt("error") }
        })
        playerView.player = p
        player = p
        audioFx.attach(p.audioSessionId)
        applyFilters()
        return p
    }

    private fun selectAudio(n: Int) {
        pendingAudio = n
        val p = player ?: return
        val groups = p.currentTracks.groups.filter { g -> g.type == C.TRACK_TYPE_AUDIO }
        if (n < 0 || n >= groups.size) return
        if (groups[n].isSelected) return
        p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
            .setOverrideForType(TrackSelectionOverride(groups[n].mediaTrackGroup, 0)).build()
    }

    // CSS-like brightness / contrast / saturation / hue / sepia, as one colour matrix on the video layer.
    private fun applyFilters() {
        val tv = playerView.videoSurfaceView as? TextureView ?: return
        val b = filt[0] / 100f
        val c = filt[1] / 100f
        val sat = filt[2] / 100f
        val hue = Math.toRadians(filt[3].toDouble())
        val sep = (filt[4] / 100f).coerceIn(0f, 1f)
        if (filt[0] == 100f && filt[1] == 100f && filt[2] == 100f && filt[3] == 0f && filt[4] == 0f) {
            tv.setLayerType(View.LAYER_TYPE_NONE, null); return
        }
        val m = ColorMatrix(floatArrayOf(b, 0f, 0f, 0f, 0f, 0f, b, 0f, 0f, 0f, 0f, 0f, b, 0f, 0f, 0f, 0f, 0f, 1f, 0f))
        val t = 255f * 0.5f * (1f - c)
        m.postConcat(ColorMatrix(floatArrayOf(c, 0f, 0f, 0f, t, 0f, c, 0f, 0f, t, 0f, 0f, c, 0f, t, 0f, 0f, 0f, 1f, 0f)))
        val sm = ColorMatrix(); sm.setSaturation(sat); m.postConcat(sm)
        if (filt[3] != 0f) {
            val cs = Math.cos(hue).toFloat(); val sn = Math.sin(hue).toFloat()
            m.postConcat(ColorMatrix(floatArrayOf(
                0.213f + cs * 0.787f - sn * 0.213f, 0.715f - cs * 0.715f - sn * 0.715f, 0.072f - cs * 0.072f + sn * 0.928f, 0f, 0f,
                0.213f - cs * 0.213f + sn * 0.143f, 0.715f + cs * 0.285f + sn * 0.140f, 0.072f - cs * 0.072f - sn * 0.283f, 0f, 0f,
                0.213f - cs * 0.213f - sn * 0.787f, 0.715f - cs * 0.715f + sn * 0.715f, 0.072f + cs * 0.928f + sn * 0.072f, 0f, 0f,
                0f, 0f, 0f, 1f, 0f)))
        }
        if (sep > 0f) {
            val k = 1f - sep
            m.postConcat(ColorMatrix(floatArrayOf(
                0.393f + 0.607f * k, 0.769f - 0.769f * k, 0.189f - 0.189f * k, 0f, 0f,
                0.349f - 0.349f * k, 0.686f + 0.314f * k, 0.168f - 0.168f * k, 0f, 0f,
                0.272f - 0.272f * k, 0.534f - 0.534f * k, 0.131f + 0.869f * k, 0f, 0f,
                0f, 0f, 0f, 1f, 0f)))
        }
        val paint = Paint()
        paint.colorFilter = ColorMatrixColorFilter(m)
        tv.setLayerType(View.LAYER_TYPE_HARDWARE, paint)
    }

    inner class Bridge {
        @JavascriptInterface
        fun api(id: Int, method: String, url: String, body: String) {
            pool.execute {
                val r = api.handle(method, url, body)
                js("window.__astraResp($id,${r.first},${JSONObject.quote(r.second)})")
            }
        }
        @JavascriptInterface
        fun play(file: String, audioIdx: Int) {
            ui.post {
                val f = api.resolve(file)
                if (f == null) { evt("error"); return@post }
                val p = ensurePlayer()
                metaSent = false
                pendingAudio = audioIdx
                p.setMediaItem(MediaItem.fromUri(Uri.fromFile(f)))
                p.prepare()
                p.playWhenReady = true
            }
        }
        @JavascriptInterface fun audioTrack(n: Int) { ui.post { selectAudio(n) } }
        @JavascriptInterface fun fx(json: String) { ui.post { try { audioFx.apply(JSONObject(json)) } catch (e: Exception) { } } }
        @JavascriptInterface fun filters(b: Double, c: Double, s: Double, h: Double, w: Double) {
            ui.post { filt = floatArrayOf(b.toFloat(), c.toFloat(), s.toFloat(), h.toFloat(), w.toFloat()); applyFilters() }
        }
        @JavascriptInterface fun resume() { ui.post { player?.playWhenReady = true } }
        @JavascriptInterface fun pause() { ui.post { player?.playWhenReady = false } }
        @JavascriptInterface fun seek(sec: Double) { ui.post { player?.seekTo((sec * 1000).toLong()) } }
        @JavascriptInterface fun volume(v: Double) { ui.post { player?.volume = v.toFloat().coerceIn(0f, 1f) } }
        @JavascriptInterface fun speed(v: Double) { ui.post { player?.playbackParameters = PlaybackParameters(v.toFloat()) } }
        @JavascriptInterface fun stop() { ui.post { player?.stop(); player?.clearMediaItems() } }
    }
}
