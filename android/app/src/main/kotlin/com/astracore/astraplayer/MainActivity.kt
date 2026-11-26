package com.astracore.astraplayer

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
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
import android.webkit.ValueCallback
import android.content.SharedPreferences
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
    private lateinit var rootView: FrameLayout
    private lateinit var prefs: SharedPreferences
    private var uiScale = 1f
    @Volatile private var fsLock = false                      // fullscreen player: always 100%, whatever the UI size setting says
    private val curScale: Float get() = uiScale        // UI size now applies in fullscreen too
    private var vx = 0.0
    private var vy = 0.0   // the player box in page (document) coordinates, CSS px
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private var metaSent = false
    private var pendingAudio = 0
    private val audioFx = AudioFx()
    private var filt = floatArrayOf(100f, 100f, 100f, 0f, 0f)
    private var needReload = false
    private val ui = Handler(Looper.getMainLooper())
    private val pool = Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors().coerceIn(3, 6))
    private val host = "https://appassets.androidplatform.net"
    companion object { @Volatile var alive = false }

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
        alive = true
        // Foreground service while the app exists: Android treats the process as "in use" and does not kill it for memory.
        if (AiSubs.liveCount() > 0) try { val si = Intent(this, KeepAliveService::class.java); if (Build.VERSION.SDK_INT >= 26) startForegroundService(si) else startService(si) } catch (e: Exception) {}
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED)
            try { requestPermissions(arrayOf("android.permission.POST_NOTIFICATIONS"), 2) } catch (e: Exception) {}

        prefs = getSharedPreferences("astra", MODE_PRIVATE)
        perfMode = getSharedPreferences("astra_ai", MODE_PRIVATE).getString("perf", "fast") ?: "fast"
        uiScale = prefs.getInt("ui", 100) / 100f
        if (Build.VERSION.SDK_INT >= 28) {
            val lp = window.attributes
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            window.attributes = lp
        }
        rootView = FrameLayout(this)
        rootView.setBackgroundColor(Color.BLACK)
        // A TextureView surface (not SurfaceView) so colour filters can be applied to the picture with a GPU colour matrix.
        playerView = LayoutInflater.from(this).inflate(R.layout.player_view, rootView, false) as PlayerView
        playerView.visibility = View.GONE   // shown only while a video plays, placed over the web page's player box
        rootView.addView(playerView, FrameLayout.LayoutParams(-1, -1))

        web = WebView(this)
        web.setBackgroundColor(Color.TRANSPARENT)
        rootView.addView(web, FrameLayout.LayoutParams(-1, -1))
        setContentView(rootView)
        // System bars: shown (and the page padded clear of them) in normal use, hidden only while the player is fullscreen.
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.parseColor("#090c12")
        window.navigationBarColor = Color.parseColor("#090c12")
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(rootView) { v, ins ->
            val bars = ins.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars() or androidx.core.view.WindowInsetsCompat.Type.displayCutout())
            if (fsLock) v.setPadding(0, 0, 0, 0) else v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            ins
        }
        web.setOnScrollChangeListener { _, _, _, _, _ -> placeVideo() }
        rootView.addOnLayoutChangeListener { _, l, t, r, b, ol, ot, orr, ob -> if (r - l != orr - ol || b - t != ob - ot) ui.post { applyUiScale() } }

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        val s = web.settings
        s.javaScriptEnabled = true
        s.useWideViewPort = true
        s.loadWithOverviewMode = false
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = false
        s.allowFileAccess = false
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(w: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCb?.onReceiveValue(null)
                fileCb = cb
                val i = Intent(Intent.ACTION_GET_CONTENT)
                i.addCategory(Intent.CATEGORY_OPENABLE)
                i.type = "*/*"
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                try { startActivityForResult(i, 77) } catch (e: Exception) { fileCb = null; cb.onReceiveValue(null); return false }
                return true
            }
        }
        web.addJavascriptInterface(Bridge(), "AstraNative")
        val shim = assets.open("native-shim.js").bufferedReader().use { r -> r.readText() }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val u = request.url
                if (u.path == "/api/meta/online/img") {
                    val b = Artwork.img(this@MainActivity, u.getQueryParameter("slug") ?: "")
                    return if (b != null) WebResourceResponse(Artwork.mime(b), null, ByteArrayInputStream(b))
                    else WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                }
                if (u.path == "/api/thumb") {
                    val file = u.getQueryParameter("file") ?: ""
                    // online mode: a YouTube file gets YouTube's own thumbnail
                    val yt = if (u.getQueryParameter("online") == "1") Artwork.ytId(file.substringAfterLast('/')) else null
                    val yb = if (yt != null) Artwork.ytThumb(this@MainActivity, yt)
                        else if (u.getQueryParameter("online") == "1") Artwork.ytByName(this@MainActivity, file.substringAfterLast('/')) else null
                    if (yb != null) return WebResourceResponse("image/jpeg", null, ByteArrayInputStream(yb))
                    val bytes = api.thumb(file)
                    return if (bytes != null) WebResourceResponse("image/jpeg", null, ByteArrayInputStream(bytes))
                    else WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                }
                return loader.shouldInterceptRequest(u)
            }
            // audit #11: the page may only navigate inside the app's own origin; anything else is blocked
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                return !(u.scheme == "https" && u.host == "appassets.androidplatform.net")
            }
            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) view.evaluateJavascript(shim, null)
            }
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, shim, setOf(host))
        }
        web.loadUrl("$host/assets/www/index.html")
        takeGo(intent); if (pendingGo != null) ui.postDelayed({ runGo() }, 800)
        takeView(intent); if (pendingOpen != null) ui.postDelayed({ runOpen() }, 800)
        ui.post(ticker)
        askStorage()
    }

    // Keeps the picture exactly under the web player box while the page scrolls (WebView scroll offset is in device px).
    private fun placeVideo() {
        val d = resources.displayMetrics.density
        playerView.translationX = (vx * d * curScale).toFloat()
        playerView.translationY = (vy * d * curScale - web.scrollY).toFloat()
    }

    /** UI size: the page gets a wider (or narrower) layout viewport and the WebView scales it natively, so touch and 100vh stay exact. */
    private fun viewportCssWidth(): Float {
        val w = if (rootView.width > 0) rootView.width else resources.displayMetrics.widthPixels
        return w / (resources.displayMetrics.density * curScale)
    }

    private fun applyUiScale() {
        web.scaleX = 1f; web.scaleY = 1f
        web.layoutParams = FrameLayout.LayoutParams(-1, -1)
        js("window.__astraViewport && window.__astraViewport(${viewportCssWidth()})")
        placeVideo()
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 77) return
        val cb = fileCb
        fileCb = null
        var out: Array<Uri>? = null
        if (resultCode == RESULT_OK && data != null) {
            val clip = data.clipData
            out = if (clip != null) Array(clip.itemCount) { i -> clip.getItemAt(i).uri } else data.data?.let { u -> arrayOf(u) }
        }
        cb?.onReceiveValue(out)
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

    private var pendingGo: String? = null
    private fun takeGo(i: Intent?) { val g = i?.getStringExtra("go"); if (!g.isNullOrEmpty()) { pendingGo = g; i?.removeExtra("go") } }
    /** Home screen shortcuts / widget: tell the web UI where to go once it is ready. */
    private fun runGo(tries: Int = 0) {
        val g = pendingGo ?: return
        web.evaluateJavascript("(function(){return !!(window.astraGo&&astraGo('" + g.replace(Regex("[^a-z]"), "") + "'))})()") { r ->
            if (r == "true") pendingGo = null else if (tries < 12) ui.postDelayed({ runGo(tries + 1) }, 700)
        }
    }
    // "Open with Astra Player" from a file manager or another app.
    private var pendingOpen: String? = null
    private fun takeView(i: Intent?) {
        if (i == null || i.action != Intent.ACTION_VIEW) return
        val u = i.data ?: return
        i.action = null   // handle it only once
        val p = uriToPath(u)
        if (p == null) android.widget.Toast.makeText(this, "Could not open that file. Open it from Files inside the app.", android.widget.Toast.LENGTH_LONG).show()
        else pendingOpen = p
    }
    private fun uriToPath(u: Uri): String? {
        if (u.scheme == "file") return u.path
        if (u.scheme != "content") return null
        try {
            if (android.provider.DocumentsContract.isDocumentUri(this, u) && u.authority == "com.android.externalstorage.documents") {
                val parts = android.provider.DocumentsContract.getDocumentId(u).split(":", limit = 2)
                val base = if (parts[0] == "primary") Environment.getExternalStorageDirectory().absolutePath else "/storage/" + parts[0]
                val f = java.io.File(base, parts.getOrElse(1) { "" })
                if (f.isFile) return f.absolutePath
            }
        } catch (e: Exception) { }
        try {
            contentResolver.query(u, arrayOf("_data"), null, null, null)?.use {
                if (it.moveToFirst()) { val v = it.getString(0); if (!v.isNullOrEmpty() && java.io.File(v).isFile) return v }
            }
        } catch (e: Exception) { }
        return null
    }
    private fun runOpen(tries: Int = 0) {
        val p = pendingOpen ?: return
        web.evaluateJavascript("(function(){return !!(window.astraOpenFile&&astraOpenFile(" + JSONObject.quote(p) + "))})()") { r ->
            if (r == "true") pendingOpen = null else if (tries < 20) ui.postDelayed({ runOpen(tries + 1) }, 700)
        }
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); takeGo(intent); runGo(); takeView(intent); runOpen() }

    override fun onResume() {
        super.onResume()
        hideBars()
        if (needReload && hasStorage()) { needReload = false; web.reload() }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideBars()
    }

    private fun hideBars() {
        val c = androidx.core.view.WindowCompat.getInsetsController(window, window.decorView)
        val t = androidx.core.view.WindowInsetsCompat.Type.systemBars()
        c.systemBarsBehavior = androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        c.isAppearanceLightStatusBars = false
        c.isAppearanceLightNavigationBars = false
        if (fsLock) c.hide(t) else c.show(t)
        androidx.core.view.ViewCompat.requestApplyInsets(rootView)
    }

    /** Back goes to the page first (close menus, step back through settings and views, leave fullscreen); only when nothing is left it sends the app to the background instead of closing it. */
    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        web.evaluateJavascript("(function(){try{return window.astraBack?astraBack():false}catch(e){return false}})()") { r ->
            if (r != "true") moveTaskToBack(true)
        }
    }

    override fun onPause() {
        super.onPause()
        player?.playWhenReady = false
        ContinueWidget.refresh(this)
        // Leaving the app while AI subtitles are being made: a small foreground service keeps the process (and the work) alive.
        if (AiSubs.liveCount() > 0) try { val si = Intent(this, KeepAliveService::class.java); if (Build.VERSION.SDK_INT >= 26) startForegroundService(si) else startService(si) } catch (e: Exception) {}
    }

    override fun onDestroy() {
        alive = false
        ui.removeCallbacks(ticker)
        ui.removeCallbacksAndMessages(null)
        pool.shutdownNow()
        web.stopLoading()
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

    private fun evt(name: String, err: String? = null) {
        val o = try { JSONObject(stateJson()) } catch (e: Exception) { JSONObject() }
        if (err != null) o.put("err", err)
        js("window.__astraEvt&&window.__astraEvt('$name',$o)")
    }

    private var perfMode = "fast"
    private var decoderMode = "auto"
    private var decoderDirty = false

    private fun ensurePlayer(): ExoPlayer {
        player?.let { return it }
        // Hardware decoders first; the bundled FFmpeg takes over when the phone's chip can't decode the stream (e.g. 10-bit HEVC).
        val rf = NextRenderersFactory(this)
            .setExtensionRendererMode(when (decoderMode) {
                "hw" -> DefaultRenderersFactory.EXTENSION_RENDERER_MODE_OFF        // phone decoders only
                "sw" -> DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER     // FFmpeg first
                else -> DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON         // phone first, FFmpeg when the chip can't
            })
            .setEnableDecoderFallback(true)
        // Fast: read far ahead and keep a back buffer (instant rewind), as far as this phone's RAM allows
        val mem = (getSystemService(ACTIVITY_SERVICE) as android.app.ActivityManager).memoryClass
        val big = perfMode != "balanced" && mem >= 192
        val lc = androidx.media3.exoplayer.DefaultLoadControl.Builder()
            .setBufferDurationsMs(if (big) 30000 else 15000, if (big) 120000 else 50000, 1500, 3000)
            .setBackBuffer(if (big) 30000 else 0, big)
            .build()
        val p = ExoPlayer.Builder(this, rf).setLoadControl(lc).build()
        p.setSeekParameters(androidx.media3.exoplayer.SeekParameters.CLOSEST_SYNC)   // jump to the nearest keyframe: instant, even with software decoding
        p.trackSelectionParameters = p.trackSelectionParameters.buildUpon().setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true).build()   // subtitles only when the page asks
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
            override fun onTracksChanged(tracks: Tracks) { selectAudio(pendingAudio); if (pendingText >= 0) selectText(pendingText) }
            override fun onVideoSizeChanged(v: androidx.media3.common.VideoSize) { evt("resize") }
            override fun onPlayerError(e: androidx.media3.common.PlaybackException) { evt("error", e.errorCodeName + ": " + (e.cause?.message ?: e.message ?: "")) }
        })
        playerView.player = p
        player = p
        audioFx.attach(p.audioSessionId)
        applyFilters()
        return p
    }

    private var pendingText = -1
    private fun selectText(ord: Int) {
        pendingText = ord
        val p = player ?: return
        val b = p.trackSelectionParameters.buildUpon()
        if (ord < 0) { p.trackSelectionParameters = b.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true).build(); return }
        val groups = p.currentTracks.groups.filter { g -> g.type == C.TRACK_TYPE_TEXT }
        if (ord >= groups.size) return
        p.trackSelectionParameters = b.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
            .setOverrideForType(TrackSelectionOverride(groups[ord].mediaTrackGroup, 0)).build()
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

    private fun toast(m: String) { android.widget.Toast.makeText(this, m, android.widget.Toast.LENGTH_LONG).show() }

    inner class Bridge {
        @JavascriptInterface fun hasStorage(): Boolean = this@MainActivity.hasStorage()
        @JavascriptInterface fun grantStorage() { ui.post { this@MainActivity.askStorage() } }
        private val kv get() = getSharedPreferences("astra_kv", MODE_PRIVATE)
        @JavascriptInterface fun kvAll(): String { val o = JSONObject(); for ((k, v) in kv.all) if (v is String) o.put(k, v); return o.toString() }
        @JavascriptInterface fun kvSet(k: String, v: String) { if (v.length < 300000) kv.edit().putString(k, v).apply() }
        @JavascriptInterface fun kvDel(k: String) { kv.edit().remove(k).apply() }
        @JavascriptInterface fun kvClear() { kv.edit().clear().apply() }
        @JavascriptInterface fun pinGo(label: String, go: String) {
            ui.post {
                try {
                    if (!androidx.core.content.pm.ShortcutManagerCompat.isRequestPinShortcutSupported(this@MainActivity)) { toast("Your launcher does not support adding icons from apps"); return@post }
                    val i = Intent(this@MainActivity, MainActivity::class.java).setAction("com.astracore.astraplayer.GO").putExtra("go", go)
                    val sc = androidx.core.content.pm.ShortcutInfoCompat.Builder(this@MainActivity, "astra-go-" + go)
                        .setShortLabel(label).setLongLabel(label)
                        .setIcon(androidx.core.graphics.drawable.IconCompat.createWithResource(this@MainActivity, R.mipmap.ic_launcher))
                        .setIntent(i).build()
                    androidx.core.content.pm.ShortcutManagerCompat.requestPinShortcut(this@MainActivity, sc, null)
                } catch (e: Exception) { toast("Could not add the icon") }
            }
        }
        @JavascriptInterface fun pinShortcut(name: String) {
            ui.post {
                try {
                    val label = name.trim().ifEmpty { "Astra Player" }
                    if (!androidx.core.content.pm.ShortcutManagerCompat.isRequestPinShortcutSupported(this@MainActivity)) { toast("Your launcher does not support adding icons from apps"); return@post }
                    val i = Intent(this@MainActivity, MainActivity::class.java).setAction(Intent.ACTION_MAIN)
                    val sc = androidx.core.content.pm.ShortcutInfoCompat.Builder(this@MainActivity, "astra-" + label.hashCode())
                        .setShortLabel(label).setLongLabel(label)
                        .setIcon(androidx.core.graphics.drawable.IconCompat.createWithResource(this@MainActivity, R.mipmap.ic_launcher))
                        .setIntent(i).build()
                    androidx.core.content.pm.ShortcutManagerCompat.requestPinShortcut(this@MainActivity, sc, null)
                } catch (e: Exception) { toast("Could not add the icon") }
            }
        }
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
                if (decoderDirty) { decoderDirty = false; player?.release(); player = null }   // new decoder choice: rebuild the player for this video
                val p = ensurePlayer()
                metaSent = false
                pendingAudio = audioIdx
                pendingText = -1
                api.currentFile = f
                p.setMediaItem(MediaItem.fromUri(Uri.fromFile(f)))
                p.prepare()
                p.playWhenReady = true
            }
        }
        @JavascriptInterface fun decoder(mode: String) {
            val m = if (mode == "hw" || mode == "sw") mode else "auto"
            if (m != decoderMode) { decoderMode = m; decoderDirty = true }
        }
        @JavascriptInterface fun subTrack(extractorIndex: Int) {
            pool.execute {
                val ord = if (extractorIndex < 0) -1 else api.textOrdinal(extractorIndex)
                ui.post { selectText(ord) }
            }
        }
        @JavascriptInterface fun audioTrack(n: Int) { ui.post { selectAudio(n) } }
        @JavascriptInterface fun fx(json: String) { ui.post { try { audioFx.applyFx(JSONObject(json)) } catch (e: Exception) { } } }
        @JavascriptInterface fun filters(b: Double, c: Double, s: Double, h: Double, w: Double) {
            ui.post { filt = floatArrayOf(b.toFloat(), c.toFloat(), s.toFloat(), h.toFloat(), w.toFloat()); applyFilters() }
        }
        @JavascriptInterface fun rect(l: Double, t: Double, w: Double, h: Double, show: Boolean) {
            ui.post {
                if (!show) { playerView.visibility = View.GONE; return@post }
                val d = resources.displayMetrics.density * curScale
                val lp = FrameLayout.LayoutParams((w * d).toInt().coerceAtLeast(1), (h * d).toInt().coerceAtLeast(1))
                playerView.layoutParams = lp
                // Round the picture's corners like the web player box (12px) so it lines up with the border; square in fullscreen.
                playerView.clipToOutline = true
                playerView.outlineProvider = object : android.view.ViewOutlineProvider() {
                    override fun getOutline(v: View, o: android.graphics.Outline) {
                        o.setRoundRect(0, 0, v.width, v.height, if (fsLock) 0f else 12f * d)
                    }
                }
                playerView.invalidateOutline()
                vx = l; vy = t
                placeVideo()
                playerView.visibility = View.VISIBLE
            }
        }
        @JavascriptInterface fun orientation(mode: String) {
            ui.post {
                requestedOrientation = if (mode == "landscape") ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }
        }
        @JavascriptInterface fun playerFs(on: Boolean) { fsLock = on; ui.post { hideBars(); placeVideo(); playerView.invalidateOutline() } }
        @JavascriptInterface fun viewportWidth(): String = viewportCssWidth().toString()
        @JavascriptInterface fun getUiScale(): Int = (uiScale * 100).toInt()
        @JavascriptInterface fun uiScale(pct: Int) {
            ui.post {
                val p = pct.coerceIn(50, 130)
                prefs.edit().putInt("ui", p).apply()
                uiScale = p / 100f
                applyUiScale()
            }
        }
        /** Saves a text file into Download/<folder>/ (for example Download/AstraPlayer-subtitles/). Returns the short path, or "" on failure. */
        @JavascriptInterface fun saveTextIn(folder: String, name: String, text: String): String {
            return try {
                val fol = folder.replace(Regex("[^A-Za-z0-9._-]"), "_").trim('.').ifEmpty { "AstraPlayer" }
                val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), fol)
                dir.mkdirs()
                val f = File(dir, name.replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), "_").trim().ifEmpty { "file" })
                f.writeText(text)
                "Download/" + fol + "/" + f.name
            } catch (e: Exception) { "" }
        }
        @JavascriptInterface fun saveText(name: String, text: String): String = saveTextIn("AstraPlayer-backup", name, text)
        /** Opens Android's own battery-saving list so the user can set Astra Player to "Unrestricted" (no special permission needed). */
        @JavascriptInterface fun batteryInfo(): String = try {
            val pm = getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager
            JSONObject().put("saver", pm.isPowerSaveMode).put("ignoring", if (Build.VERSION.SDK_INT >= 23) pm.isIgnoringBatteryOptimizations(packageName) else true).toString()
        } catch (e: Exception) { "{}" }
        @JavascriptInterface fun openBattery() { ui.post { try { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) } catch (e: Exception) { try { startActivity(Intent(Settings.ACTION_SETTINGS)) } catch (e2: Exception) {} } } }
        /** Opens a GitHub page in the browser (only github.com links, nothing else). */
        @JavascriptInterface fun openUrl(url: String) { if (url.startsWith("https://github.com/")) ui.post { try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (e: Exception) {} } }
        @JavascriptInterface fun appInfo(): String = try {
            val pi = packageManager.getPackageInfo(packageName, 0)
            val am = getSystemService(android.content.Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            val mi = android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(mi)
            val df = java.text.SimpleDateFormat("d MMM yyyy, HH:mm", java.util.Locale.getDefault())
            @Suppress("DEPRECATION") val code = if (Build.VERSION.SDK_INT >= 28) pi.longVersionCode else pi.versionCode.toLong()
            org.json.JSONObject().put("version", pi.versionName).put("code", code).put("pkg", packageName)
                .put("android", "Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")")
                .put("device", Build.MANUFACTURER + " " + Build.MODEL).put("abi", Build.SUPPORTED_ABIS.firstOrNull() ?: "")
                .put("ram", (mi.totalMem / 1048576).toString() + " MB total, " + (mi.availMem / 1048576) + " MB free")
                .put("dataDir", (getExternalFilesDir(null) ?: filesDir).absolutePath)
                .put("installed", df.format(java.util.Date(pi.firstInstallTime))).put("updated", df.format(java.util.Date(pi.lastUpdateTime))).toString()
        } catch (e: Exception) { "{}" }
        @JavascriptInterface fun perf(mode: String) {
            getSharedPreferences("astra_ai", MODE_PRIVATE).edit().putString("perf", if (mode == "balanced") "balanced" else "fast").apply()
            perfMode = if (mode == "balanced") "balanced" else "fast"
        }
        @JavascriptInterface fun resume() { ui.post { player?.playWhenReady = true } }
        @JavascriptInterface fun pause() { ui.post { player?.playWhenReady = false } }
        @JavascriptInterface fun seek(sec: Double) { ui.post { player?.seekTo((sec * 1000).toLong()) } }
        @JavascriptInterface fun volume(v: Double) { ui.post { player?.volume = v.toFloat().coerceIn(0f, 1f) } }
        @JavascriptInterface fun speed(v: Double) { ui.post { player?.playbackParameters = PlaybackParameters(v.toFloat()) } }
        @JavascriptInterface fun stop() { ui.post { player?.stop(); player?.clearMediaItems() } }
    }
}
