/* Astra Player (Android app): connects the web UI to the native player and the in-app data layer. */
(function () {
  if (!window.AstraNative) return;
  var N = window.AstraNative;
  if (document.documentElement) document.documentElement.classList.add('astra-native');

  /* ---- UI size: layout viewport width in CSS px, set by the app (smaller UI size = wider viewport) ---- */
  var vpW = 0;
  function setVp(w) {
    if (w) vpW = w;
    if (!vpW) return;
    var c = 'width=' + vpW + ', user-scalable=no, viewport-fit=cover';
    var ms = document.querySelectorAll('meta[name=viewport]');
    if (!ms.length) { var m = document.createElement('meta'); m.name = 'viewport'; m.content = c; (document.head || document.documentElement).appendChild(m); }
    else for (var i = 0; i < ms.length; i++) ms[i].setAttribute('content', c);
  }
  window.__astraViewport = setVp;
  try { setVp(parseFloat(N.viewportWidth())); } catch (e) {}
  document.addEventListener('DOMContentLoaded', function () { setVp(); });

  /* ---- settings survive the app being closed: localStorage is mirrored into the app's own storage ---- */
  try {
    var ls = window.localStorage, kvAll = JSON.parse(N.kvAll() || '{}');
    Object.keys(kvAll).forEach(function (k) { if (ls.getItem(k) === null) ls.setItem(k, kvAll[k]); });
    var sp = Storage.prototype, si = sp.setItem, ri = sp.removeItem, ci = sp.clear;
    sp.setItem = function (k, v) { si.call(this, k, v); if (this === ls) { try { N.kvSet(String(k), String(v)); } catch (e) {} } };
    sp.removeItem = function (k) { ri.call(this, k); if (this === ls) { try { N.kvDel(String(k)); } catch (e) {} } };
    sp.clear = function () { ci.call(this); if (this === ls) { try { N.kvClear(); } catch (e) {} } };
  } catch (e) {}

  /* ---- /api/* goes to the app instead of a server ---- */
  var of = window.fetch.bind(window), seq = 0, pend = {};
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(location.origin) === 0) url = url.slice(location.origin.length);
    if (url.indexOf('/api/subs/') === 0) return subsFetch(url);
    if (url.indexOf('/api/') === 0 && !/^\/api\/thumb\?/.test(url)) {
      var method = (init && init.method) || 'GET', body = init && init.body ? String(init.body) : '';
      return new Promise(function (res) { var id = ++seq; pend[id] = res; N.api(id, method, url, body); });
    }
    return of(input, init);
  };
  window.__astraResp = function (id, status, text) {
    var r = pend[id]; delete pend[id];
    if (r) r(new Response(text, { status: status, headers: { 'Content-Type': 'application/json' } }));
  };

  /* ---- subtitles: the app returns raw SRT / ASS text, the same converters as the server turn it into WebVTT cues ---- */
  function subsFetch(url) {
    return new Promise(function (res) {
      var id = ++seq;
      pend[id] = function (resp) {
        resp.text().then(function (t) {
          if (resp.status !== 200) return res(new Response(t, { status: resp.status }));
          try {
            var o = JSON.parse(t), C = window.astraSubConv, vtt;
            if (o.fmt === 'ass') vtt = C.assToVtt(o.text);
            else if (o.fmt === 'srt') vtt = C.assToVtt(C.srtToAss(o.text));
            else vtt = C.cleanAndDedupeVTT(o.text);
            res(new Response(vtt, { status: 200, headers: { 'Content-Type': 'text/vtt' } }));
          } catch (e) { res(new Response('Subtitle conversion failed', { status: 500 })); }
        });
      };
      N.api(id, 'GET', url, '');
    });
  }
  function ts(x) {
    var m = /^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{1,3})/.exec(x.trim());
    return m ? ((+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+((m[4] + '00').slice(0, 3))) / 1000) : 0;
  }
  function parseVtt(text) {
    var cues = [];
    String(text).replace(/\r/g, '').split(/\n\n+/).forEach(function (blk) {
      var lines = blk.split('\n'), k = -1, i;
      for (i = 0; i < lines.length; i++) if (lines[i].indexOf('-->') >= 0) { k = i; break; }
      if (k < 0) return;
      var t = lines[k].split('-->');
      cues.push({ startTime: ts(t[0]), endTime: ts(t[1].trim().split(/\s/)[0]), text: lines.slice(k + 1).join('\n') });
    });
    return cues;
  }
  var fakeTrack = { mode: 'hidden', cues: [], kind: 'subtitles' }, trackSrc = '';
  document.addEventListener('DOMContentLoaded', function () {
    var mt = document.getElementById('mainTrack');
    if (!mt) return;
    Object.defineProperty(mt, 'track', { get: function () { return fakeTrack; }, configurable: true });
    Object.defineProperty(mt, 'src', { get: function () { return trackSrc; }, set: function (u) { trackSrc = String(u || ''); }, configurable: true });
    mt.removeAttribute = function (k) { if (k === 'src') { trackSrc = ''; fakeTrack.cues = []; try { N.subTrack(-1); } catch (e) {} } };
  });
  window.astraSetSubs = function (url) {
    trackSrc = url; fakeTrack.cues = [];
    var em = /\/api\/subs\/stream\?.*trackIndex=(\d+)/.exec(String(url));
    if (em) { try { N.subTrack(+em[1]); } catch (e) {} return Promise.resolve(); }   // embedded: drawn by the native player
    try { N.subTrack(-1); } catch (e) {}
    return fetch(url).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(String(t || ('error ' + r.status)).slice(0, 80)); });
      return r.text();
    }).then(function (t) { fakeTrack.cues = parseVtt(t); });
  };

  /* UI size now lives in Settings > General (script.js calls AstraNative.uiScale) */

  /* ---- backup file: written straight into the Download folder ---- */
  window.astraNativeSave = function (name, text, folder) { try { return (folder ? N.saveTextIn(folder, name, text) : N.saveText(name, text)) || ''; } catch (e) { return ''; } };

  /* ---- equalizer and filters go to the native player ---- */
  window.astraNativeFx = function (o) { try { N.fx(JSON.stringify(o)); } catch (e) {} };
  window.astraNativeFilters = function (b, c, s, h, w) { try { N.filters(+b, +c, +s, +h, +w); } catch (e) {} };
  window.astraNativeAudio = function (n) { try { N.audioTrack(n | 0); } catch (e) {} };

  /* ---- transparent page while a video plays, so the native picture shows through ---- */
  var st = document.createElement('style');
  st.textContent = 'html.astra-native .astra-clear{background:transparent!important;background-image:none!important}html.astra-native #glCanvas,html.astra-native .source-mode-pill{display:none!important}html.astra-native .astra-hide{visibility:hidden!important}' +
    '.web-only{display:none!important}';
  document.addEventListener('DOMContentLoaded', function () { document.documentElement.classList.add('astra-native'); document.head.appendChild(st); });
  var clearOn = false;
  function clear(on) {
    if (on === clearOn) return;
    clearOn = on;
    var e = document.getElementById('playerWrapper');
    while (e) { e.classList.toggle('astra-clear', on); e = e.parentElement; }
  }

  /* ---- keep the native picture exactly under the web player box; hide it everywhere else ---- */
  var lastRect = '';
  function syncRect() {
    var w = document.getElementById('playerWrapper'), vis = false, r = null;
    if (w && window.__astraActive && window.__astraActive() && w.getClientRects().length > 0) {
      r = w.getBoundingClientRect();
      vis = r.width > 2 && r.height > 2;
    }
    clear(vis);
    // document coordinates: the app moves the picture together with the page's scroll position, frame by frame
    var top = vis ? r.top + (window.pageYOffset || 0) : 0;
    var key = vis ? [r.left, top, r.width, r.height].map(Math.round).join(',') : 'x';
    if (key !== lastRect) { lastRect = key; N.rect(vis ? r.left : 0, top, vis ? r.width : 0, vis ? r.height : 0, vis); }
  }
  setInterval(syncRect, 200);
  window.addEventListener('scroll', syncRect, true);
  window.addEventListener('resize', syncRect);
  window.__astraSyncRect = syncRect;

  /* ---- fullscreen: a CSS fullscreen (the page's :fullscreen rules are mirrored as .astra-fs) plus real native rotation ---- */
  var fsEl = null;
  Object.defineProperty(document, 'fullscreenElement', { get: function () { return fsEl; }, configurable: true });
  Object.defineProperty(document, 'webkitFullscreenElement', { get: function () { return fsEl; }, configurable: true });
  var hiddenEls = [];
  function fsHidePage(el) {
    hiddenEls.forEach(function (c) { c.classList.remove('astra-hide'); });
    hiddenEls = [];
    if (!el || el === document.documentElement) return;
    var n = el;
    while (n && n !== document.documentElement) {
      var p = n.parentElement;
      if (!p) break;
      Array.prototype.forEach.call(p.children, function (c) { if (c !== n) { c.classList.add('astra-hide'); hiddenEls.push(c); } });
      n = p;
    }
  }
  function fsSet(el) {
    if (fsEl && fsEl !== el && fsEl.classList) fsEl.classList.remove('astra-fs');
    fsEl = el;
    fsHidePage(el);
    if (el && el !== document.documentElement) el.classList.add('astra-fs');
    document.documentElement.classList.toggle('astra-fs-on', !!el);
    setTimeout(function () { document.dispatchEvent(new Event('fullscreenchange')); syncRect(); }, 0);
  }
  Element.prototype.requestFullscreen = function () { fsSet(this); return Promise.resolve(); };
  document.exitFullscreen = function () { fsSet(null); return Promise.resolve(); };
  try {
    screen.orientation.lock = function () {
      N.orientation('landscape');
      return new Promise(function (res) {
        var done = false;
        function f() { if (done) return; done = true; window.removeEventListener('resize', f); res(); }
        window.addEventListener('resize', f); setTimeout(f, 900);
      });
    };
    screen.orientation.unlock = function () { N.orientation('unspecified'); };
  } catch (e) {}

  /* ---- a stand-in for the <video> element, backed by the native player ---- */
  window.astraMakeVideo = function (real) {
    var et = new EventTarget(), v = {}, S = { t: 0, d: NaN, b: 0, w: 0, h: 0, paused: true, ended: false, rate: 1, vol: 1, muted: false, seeking: false, src: '', ready: 0, target: 0, stok: 0 };
    var dummy = document.createElement('div');
    function emit(n) {
      var e = new Event(n); et.dispatchEvent(e);
      if (typeof v['on' + n] === 'function') { try { v['on' + n](e); } catch (x) { console.error(x); } }
    }
    function def(k, g, s) { Object.defineProperty(v, k, { get: g, set: s, enumerable: true, configurable: true }); }
    ['addEventListener', 'removeEventListener', 'dispatchEvent'].forEach(function (k) { v[k] = et[k].bind(et); });
    def('currentTime', function () { return S.t; }, function (x) {
      x = Number(x) || 0; S.t = x; S.seeking = true; S.target = x; var tok = ++S.stok; N.seek(x); emit('seeking');
      setTimeout(function () { if (S.stok === tok && S.seeking) { S.seeking = false; emit('seeked'); } }, 2500);   // never stay stuck in "seeking"
    });
    def('duration', function () { return S.d; });
    def('paused', function () { return S.paused; });
    def('ended', function () { return S.ended; });
    def('seeking', function () { return S.seeking; });
    def('readyState', function () { return S.ready; });
    def('videoWidth', function () { return S.w; });
    def('videoHeight', function () { return S.h; });
    def('volume', function () { return S.vol; }, function (x) { S.vol = Math.max(0, Math.min(1, Number(x))); N.volume(S.muted ? 0 : S.vol); emit('volumechange'); });
    def('muted', function () { return S.muted; }, function (x) { S.muted = !!x; N.volume(S.muted ? 0 : S.vol); emit('volumechange'); });
    def('playbackRate', function () { return S.rate; }, function (x) { S.rate = Number(x) || 1; N.speed(S.rate); emit('ratechange'); });
    def('defaultPlaybackRate', function () { return 1; }, function () {});
    function ranges(end) { return { length: end > 0 ? 1 : 0, start: function () { return 0; }, end: function () { return end; } }; }
    def('buffered', function () { return ranges(S.b); });
    def('seekable', function () { return ranges(S.d > 0 ? S.d : S.b); });
    def('style', function () { return dummy.style; });
    def('classList', function () { return dummy.classList; });
    def('parentElement', function () { return real.parentElement; });
    def('src', function () { return S.src; }, function (u) {
      S.src = String(u || ''); S.t = 0; S.d = NaN; S.ended = false; S.ready = 0;
      var m = /[?&]file=([^&]*)/.exec(S.src);
      if (S.src.indexOf('/stream?') >= 0 && m) { var am = (typeof activeAudioStreamIndex === 'string') ? /^0:a:(\d+)$/.exec(activeAudioStreamIndex) : null;
        N.play(decodeURIComponent(m[1]), am ? +am[1] : 0); emit('loadstart'); }
      else if (S.src) { emit('error'); }
    });
    v.removeAttribute = function (k) { if (k === 'src') S.src = ''; };
    v.getAttribute = function (k) { return k === 'src' ? (S.src || null) : real.getAttribute(k); };
    v.load = function () { if (!S.src) { N.stop(); S.paused = true; syncRect(); } };
    v.play = function () { var was = S.paused; S.paused = false; N.resume(); if (was) emit('play'); return Promise.resolve(); };
    v.pause = function () { var was = !S.paused; S.paused = true; N.pause(); if (was) emit('pause'); };
    window.__astraActive = function () { return !!S.src; };
    /* no getVideoPlaybackQuality here on purpose: the page must not run its frame-count checks on the native player (audit #5) */

    function merge(o) {
      if (!o) return;
      if (S.seeking && typeof o.t === 'number' && Math.abs(o.t - S.target) < 1.5) { S.seeking = false; S.t = o.t; setTimeout(function () { emit('seeked'); }, 0); }
      if (typeof o.t === 'number' && !S.seeking) S.t = o.t;
      if (o.d > 0) S.d = o.d;
      if (typeof o.b === 'number') S.b = o.b;
      if (o.w) S.w = o.w;
      if (o.h) S.h = o.h;
      if (typeof o.paused === 'boolean') S.paused = o.paused;
      S.ended = !!o.ended;
    }
    window.__astraState = function (o) { merge(o); emit('timeupdate'); emit('progress'); };
    window.__astraEvt = function (n, o) {
      merge(o);
      if (n === 'seeked') { S.seeking = false; if (o && typeof o.t === 'number') S.t = o.t; }
      if (n === 'loadedmetadata') { S.ready = 4; emit('loadedmetadata'); emit('durationchange'); emit('canplay'); return; }
      if (n === 'canplay') { S.ready = 4; S.seeking = false; }
      if (n === 'resize') { emit('resize'); return; }
      if (n === 'error' && o && o.err && window.showToast) { try { window.showToast('Player: ' + o.err, 6000, 'err'); } catch (e) {} }
      emit(n);
      if (n === 'timeupdate') return;
      emit('timeupdate');
    };
    return v;
  };
})();
