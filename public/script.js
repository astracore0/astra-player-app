
function formatPlayerTitle(title, epInfo) {
  return `<span style="color: #ffffff;">${title}</span> <span style="color: #9ca3af;">•</span> <span style="color: #3b82f6;">${epInfo}</span>`;
}

'use strict';

/* ---- v1.14 multi-device sync: settings are kept on the server and shared by every device ---- */
const SYNC_KEYS = ['astra_prefs', 'astra_saved_filters', 'astra_video_prefs', 'astra_user_settings'];
const syncStamps = (() => { try { return JSON.parse(localStorage.getItem('astra_sync_t') || '{}') || {}; } catch (e) { return {}; } })();
const rawSet = Storage.prototype.setItem;
function syncStampSave() { try { rawSet.call(localStorage, 'astra_sync_t', JSON.stringify(syncStamps)); } catch (e) {} }
let syncPending = {}, syncTimer = null, syncApplying = false;
const syncDirty = (() => { try { return JSON.parse(localStorage.getItem('astra_sync_d') || '{}') || {}; } catch (e) { return {}; } })();   // changed here, not yet confirmed by the server
function syncDirtySave() { try { rawSet.call(localStorage, 'astra_sync_d', JSON.stringify(syncDirty)); } catch (e) {} }
function syncPush() {
  syncTimer = null;
  const changes = syncPending; syncPending = {};
  if (!Object.keys(changes).length) return;
  fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes }), keepalive: true })
    .then((r) => r.json()).then((d) => { Object.keys(changes).forEach((k) => { if (d.keys && d.keys[k] && d.keys[k].v === changes[k].v) syncStamps[k] = d.keys[k].t; delete syncDirty[k]; }); syncStampSave(); syncDirtySave(); })
    .catch(() => {
    Object.keys(changes).forEach((k) => { if (!syncPending[k]) syncPending[k] = changes[k]; });       // retry with the next change
  });
}
Storage.prototype.setItem = function (k, v) {
  rawSet.call(this, k, v);
  if (this === localStorage && !syncApplying && SYNC_KEYS.includes(k)) {
    syncPending[k] = { v: String(v) }; syncDirty[k] = 1; syncDirtySave();
    clearTimeout(syncTimer); syncTimer = setTimeout(syncPush, 600);
  }
};
// Adopt whatever is newer on the server; send up whatever this device has that is newer. Returns true if local data changed.
function syncMerge(keys) {
  let changed = false; const up = {};
  syncApplying = true;
  SYNC_KEYS.forEach((k) => {
    const sv = keys[k], lt = syncStamps[k] || 0, lv = localStorage.getItem(k);
    if (sv && sv.t > lt && !syncDirty[k]) { if (lv !== sv.v) { rawSet.call(localStorage, k, sv.v); changed = true; } syncStamps[k] = sv.t; }
    else if (lv !== null && (!sv || sv.v !== lv)) up[k] = { v: lv };
    else if (sv && sv.v === lv) delete syncDirty[k];
  });
  syncApplying = false; syncStampSave();
  if (Object.keys(up).length) fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: up }) })
    .then((r) => r.json()).then((d) => { Object.keys(up).forEach((k) => { if (d.keys && d.keys[k]) syncStamps[k] = d.keys[k].t; delete syncDirty[k]; }); syncStampSave(); syncDirtySave(); }).catch(() => {});
  return changed;
}
window.addEventListener('pagehide', () => { if (Object.keys(syncPending).length) syncPush(); });
window.syncFlush = () => { if (Object.keys(syncPending).length) syncPush(); };
(function syncStart() {                       // blocking on purpose: settings must be in place before the page reads them
  try {
    const x = new XMLHttpRequest(); x.open('GET', '/api/profile', false); x.send();
    if (x.status === 200) syncMerge(JSON.parse(x.responseText).keys || {});
  } catch (e) {}
})();

const $ = (id) => document.getElementById(id);

const video = window.astraMakeVideo ? window.astraMakeVideo($('videoElement')) : $('videoElement');
const glCanvas = $('glCanvas');
const playerWrapper = $('playerWrapper');
const topOverlay = $('topOverlay');
const bottomOverlay = $('bottomOverlay');
const timelineSlider = $('timelineSlider');
const trackPlayed = $('trackPlayed');
const trackBuffer = $('trackBuffer');
const timeLabel = $('timeLabel');
const playBtn = $('playBtn');
const playIconSvg = $('playIconSvg');
const volBtn = $('volBtn');
const volIconSvg = $('volIconSvg');
const rwBtn = $('rwBtn');
const ffBtn = $('ffBtn');
const fsBtn = $('fsBtn');
const lockBtn = $('lockBtn');
const playerCurrentTitle = $('playerCurrentTitle');
const playerCurrentFolder = $('playerCurrentFolder');
const playerResBadge = $('playerResBadge');
const streamModeBadge = $('streamModeBadge');
const sourceModePill = $('sourceModePill');
const playerDurationBadge = $('playerDurationBadge');
const settingsBtn = $('settingsBtn');
const settingsModal = $('settingsModal');
const manualCenterPlay = $('manualCenterPlay');
const bigPlayBtn = $('bigPlayBtn');
const mainTrack = $('mainTrack');
const playerBufferingIndicator = $('playerBufferingIndicator');
const probeLoadingText = $('probeLoadingText');
const subDisplayBox = $('subDisplayBox');

const heroTitle = $('heroTitle');
const heroSynopsis = $('heroSynopsis');
const heroProgressPill = $('heroProgressPill');
const heroResumeBtn = $('heroResumeBtn');
const heroResumeLabel = $('heroResumeLabel');

const audioTrackList = $('audioTrackList');
const subTrackList = $('subTrackList');
const ramGraphCanvas = $('ramGraphCanvas');
const ramStatsText = $('ramStatsText');

const playerEpisodesDrawer = $('playerEpisodesDrawer');
const floatingEpisodesBtn = $('floatingEpisodesBtn');
const closeEpisodesDrawerBtn = $('closeEpisodesDrawerBtn');
const episodesDrawerList = $('episodesDrawerList');
const epDrawerFolderName = $('epDrawerFolderName');
const playerInlinePlaylist = $('playerInlinePlaylist');
const playerShelfTitle = $('playerShelfTitle');

const seriesCardsGrid = $('seriesCardsGrid');
const historyGrid = $('historyGrid');
const homeQuickSearch = $('homeQuickSearch');

const storagePathInputField = $('storagePathInputField');
const btnGoPathInput = $('btnGoPathInput');
const subPickerPathInputField = $('subPickerPathInputField');
const btnGoSubPickerInput = $('btnGoSubPickerInput');

const rngSubDelay = $('rngSubDelay');
const eqBassSlider = $('eqBass');
const eqTrebleSlider = $('eqTreble');

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
let fullLibrary = {};
let libraryRoot = '';
let currentPathTokens = [];
let currentVideoList = [];
let forcePauseOnce = false;
let activeVideoPath = '';
let historyCache = {};
let currentExplicitDuration = 0;
let currentVideoFps = 0;
let lastRecordedTime = 0;
let currentBrowsingDir = '';
let currentParentDir = '';
let activeAudioStreamIndex = '0:a:0';
let isTranscodingMode = false;
const TC_SID = Math.random().toString(36).slice(2, 10);   // identifies THIS page's stream to the server
let transcodeBaseOffset = 0;
let isCurrentFile10Bit = false;   // true = the transcoder must re-encode the picture (real 10-bit, or compatibility mode)
let sourceIs10Bit = false;        // what the FILE really is (used for the 8-bit/10-bit readout)
let compatMode = false;
let nativeFallbackTried = false;
let preferredDefaultLang = 'auto';
let preferredSubLang = '';
let isScreenLocked = false;
let isScrubbing = false;
let currentView = '';
let playToken = 0;
let sessionRestoreDone = false;
let subsOn = false;
let subDelay = 0;          // seconds; + = subtitles appear later
let playbackSpeed = 1;
const PREF_DEFAULTS = { v: 4, networkMode: "offline", thumbQuality: "360p", seekStep: 10, quality: 'auto', lite: 'auto', anim: true, preBuffer: 0, preBufMB8: 0, preBufMB10: 0, autoPlay: true, autoSkip: false, autoNext: true, uiNav: true, perf: 'fast', floatResume: true, listChips: true, newDays: 3, decoder: 'auto', uiChapter: true, uiCast: true, uiLock: true, uiQuality: true, thumbs: true, fsRotate: true, fsFill: false, hwEnc: 'off' };
const prefs = Object.assign({}, PREF_DEFAULTS);
try {
  const saved = JSON.parse(localStorage.getItem('astra_prefs') || '{}');
  // v3: back to the v1.3 transcoder defaults (720p software x264, no pre-buffer wait) once.
  const migrated = saved.v !== 4;
  if (migrated) { delete saved.quality; delete saved.preBuffer; delete saved.hwEnc; saved.v = 4; saved.fsRotate = true; }   // one-time migration; stamping v=4 stops it wiping the quality choice on every load
  Object.assign(prefs, saved);
  prefs.v = 4;
  if (migrated) try { localStorage.setItem('astra_prefs', JSON.stringify(prefs)); } catch (e) {}
} catch (e) {}
// v2: fullscreen always goes landscape by default (the old default was off)
function savePrefs() { try { localStorage.setItem('astra_prefs', JSON.stringify(prefs)); } catch (e) {} }
let internalPause = false;
let qualityOverride = null;
// Auto resolution mode: start at 720p, step down when the phone cannot decode in real time.
const AUTO_LEVELS = ['balanced', 'fast', 'low'];
let autoLevel = 0;
function effectiveQuality() { return qualityOverride || (prefs.quality === 'auto' ? AUTO_LEVELS[autoLevel] : prefs.quality); }
// 10-bit HEVC is re-encoded live: always keep a 5 s head start so playback does not stutter right away.
// Pre-buffer is set in memory (MB); the player turns it into seconds using this video's own data rate.
let currentFileBytes = 0;
const TC_BYTES_PER_SEC = { low: 90e3, fast: 150e3, balanced: 250e3, quality: 500e3, mb5: 625e3, fhd: 1e6, qhd: 1.6e6, uhd: 2.3e6 };
function estBytesPerSec() {
  const tc = isTranscodingMode && isCurrentFile10Bit;
  if (tc) return TC_BYTES_PER_SEC[effectiveQuality()] || 250e3;
  const d = getDuration && getDuration();
  return currentFileBytes > 0 && d > 0 ? currentFileBytes / d : 450e3;            // typical 720p anime when no file is open
}
function bufSeconds(mb, tc) {
  const bps = tc ? (TC_BYTES_PER_SEC[effectiveQuality()] || 250e3) : estBytesPerSec();
  return mb > 0 ? Math.min(600, (mb * 1048576) / bps) : 0;
}
function needBuf() {
  const tc = isTranscodingMode && isCurrentFile10Bit;
  const sec = bufSeconds(tc ? prefs.preBufMB10 : prefs.preBufMB8, tc);
  return tc ? Math.max(5, sec) : Math.min(sec, 20);            // 8-bit is light: never hold playback back for long
}
let startWatch = null;
let sleepTimerId = null;
let sleepAtEnd = false;

let audioCtx = null, audioSrcNode = null, delayNode = null, bassFilter = null, trebleFilter = null;
let currentAudioOffset = 0.0;
let eqOn = true, eqBands = [0, 0, 0, 0, 0], eqBoost = 0, eqVirt = 0, eqReverb = 'none', eqPreset = 'flat';
let eqNodes = [], eqBoostNode = null, fxSplit = null, fxMerge = null, fxGain = {}, fxDry = null, fxWet = null, fxMaster = null, fxConv = null, fxConvWired = false;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */
function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* storage full / blocked */ }
}
function lsRemove(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

/* Per-episode memory: chosen subtitle and subtitle delay, kept for the last 300 episodes */
const VP_KEY = 'astra_video_prefs';
function vpAll() { try { return JSON.parse(lsGet(VP_KEY) || '{}') || {}; } catch (e) { return {}; } }
function vpGet(p) { return (p && vpAll()[p]) || {}; }
function vpSet(p, patch) {
  if (!p) return;
  const all = vpAll();
  all[p] = Object.assign({}, all[p], patch, { t: Date.now() });
  const keys = Object.keys(all);
  if (keys.length > 300) keys.sort((a, b) => (all[a].t || 0) - (all[b].t || 0)).slice(0, keys.length - 300).forEach((k) => delete all[k]);
  lsSet(VP_KEY, JSON.stringify(all));
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

let toastTimer = null;
/* toast colours v2 */
// ok = green (done), warn = yellow (careful / nothing happened), err = red (failed), info = theme blue (working / neutral)
function toastKind(msg) {
  const m = String(msg).toLowerCase();
  if (/online mode|offline mode/.test(m)) return 'info';
  if (/built-in tracks|nothing to remove|pick a subtitle|froze|ended early|no subtitle|last episode|first episode|switching to|drag the/.test(m)) return 'warn';
  if (/fail|error|could not|couldn.t|cannot|can.t|not found|not reachable|unreachable|rejected|denied|refused|no space|no video data|crash|went wrong/.test(m)) return 'err';
  if (/warn|slow|retry|retrying|busy|waiting|missing|needs|please|not set|cleared|removed|deleted|cancel|stopp|paused|heavy|no internet|offline|animations off|key removed|\boff\b/.test(m)) return 'warn';
  if (/saved|copied|generated|attached|added|rescanned|root set|found|queued|animations on|synchron|updated|applied|enabled|done|ready|complete|success|\bon\b/.test(m)) return 'ok';
  if (/^(nothing|no messages|idle|all good)/.test(m)) return 'gray';
  return 'info';
}

function formatOldEnglishNotice(rawMsg) {
  const s = String(rawMsg || '').trim();
  const low = s.toLowerCase();

  const rules = [
    [/subtitle could not be loaded/i, 'Failed to load the subtitle', 'The requested subtitle scroll could not be retrieved.'],
    [/loading subtitle/i, 'Summoning the subtitle scroll', 'Preparing text synchronization for this chapter.'],
    [/subtitle saved/i, 'Subtitle scroll inscribed', 'Saved safely unto thy local storage (.srt).'],
    [/subtitle removed/i, 'Subtitle scroll banished', 'Removed from the active reel.'],
    [/subtitle attached/i, 'Subtitle scroll bound', 'External text track linked to this motion picture.'],
    [/subtitles generated/i, 'Transcription hath concluded', 'All spoken lines have been inscribed successfully.'],
    [/subtitle generation failed/i, 'Failed to transcribe speech', 'The scribe encountered an error whilst listening.'],
    [/subtitle delay/i, 'Subtitle timing adjusted', s],
    [/drag the white handle/i, 'Grasp the white orb to seek', 'Direct tapping upon the bar is warded against misclicks.'],
    [/this is the last episode/i, 'Thou hast reached the final chapter', 'No further episodes remain within this tome.'],
    [/this is the first episode/i, 'Thou art at the very beginning', 'No prior episodes precede this chapter.'],
    [/watch history cleared/i, 'Chronicles wiped clean', 'All prior watch records have been expunged.'],
    [/library rescanned/i, 'Archives surveyed anew', s.replace(/^Library rescanned\s*[—-]\s*/i, '')],
    [/media root set/i, 'Sanctuary root appointed', s.replace(/^Media root set\s*[—-]\s*/i, '')],
    [/tv link copied/i, 'Vessel address copied', 'Paste this link into thy Smart TV browser to begin.'],
    [/device scan failed/i, 'Scouting the realm failed', 'Unable to survey nearby network vessels.'],
    [/playback failed/i, 'Failed to render motion picture', 'The file may be missing or of an unyielding format.'],
    [/format not supported natively/i, 'Engaging live transmutation', 'Native playback failed; converting stream via engine.'],
    [/no picture from this video/i, 'Engaging visual transmutation', 'Audio detected without picture; converting stream.'],
    [/picture froze/i, 'Mending frozen frame', 'Restarting the stream to restore smooth motion.'],
    [/stream ended early/i, 'The stream halted prematurely', 'Seek slightly or press Play to resume thy journey.'],
    [/could not reach the server/i, 'The server doth not answer', 'Verify thy local host connection and try once more.'],
    [/thumbnail cache cleared/i, 'Portraits purged', 'All cached thumbnails have been cleared.'],
    [/settings updated from another device/i, 'Configuration synchronized', 'Updated preferences received from a companion device.'],
    [/saved filter/i, 'Visual filter preserved', s],
    [/filter:/i, 'Visual filter applied', s],
    [/speed /i, 'Tempo altered', s],
    [/animations on/i, 'Motion flourishes enabled', 'Interface transitions are now active.'],
    [/animations off/i, 'Motion flourishes quelled', 'Reduced motion for swifter performance.'],
    [/online ai saved/i, 'Cloud scribe configured', 'Thy API credentials have been safely stored.'],
    [/key removed/i, 'Credentials expunged', 'API key removed; local scribe shall be used.'],
    [/sleep timer: paused/i, 'Slumber timer elapsed', 'Playback hath been paused as thou commanded.'],
    [/skipped /i, 'Chapter bypassed', s]
  ];

  for (const [re, title, sub] of rules) {
    if (re.test(s)) return { title, sub };
  }

  // Fallback for any other dynamic message
  if (low.includes('failed') || low.includes('could not') || low.includes('error')) {
    return { title: s, sub: 'An unforeseen fault occurred during this task.' };
  }
  return { title: s, sub: '' };
}

const TOAST_ICONS = {
  info: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="currentColor"/><rect x="11" y="10.5" width="2" height="7" rx="1" fill="#fff"/><circle cx="12" cy="7.3" r="1.3" fill="#fff"/></svg>',
  ok: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M7 12.4l3.2 3.2L17 8.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  warn: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="currentColor"/><rect x="11" y="6" width="2" height="8" rx="1" fill="#1a1400"/><circle cx="12" cy="17.2" r="1.3" fill="#1a1400"/></svg>',
  err: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M7.5 7.5l9 9" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
  gray: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="currentColor"/><rect x="11" y="10.5" width="2" height="7" rx="1" fill="#fff"/><circle cx="12" cy="7.3" r="1.3" fill="#fff"/></svg>'
};
function showToast(message, ms = 3400, kind) {
  let el = $('astraToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'astraToast';
    el.className = 'astra-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span class="at-ico"></span><div class="at-text"><b class="at-title"></b><span class="at-sub"></span></div><button type="button" class="at-x" aria-label="Close notification"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="at-bar-wrap"><i class="at-bar"></i></div>';
    el.querySelector('.at-x').addEventListener('click', (ev) => { ev.stopPropagation(); clearTimeout(toastTimer); el.classList.remove('show'); });
    ['pointerdown', 'touchstart'].forEach((t) => el.addEventListener(t, (ev) => ev.stopPropagation()));
  }
  const host = toastHost();
  if (el.parentNode !== host) host.appendChild(el);

  const { title, sub } = (message && typeof message === 'object') ? message : formatOldEnglishNotice(message);
  el.querySelector('.at-title').textContent = title;
  el.querySelector('.at-sub').textContent = sub || '';

  const k = kind || (message && typeof message === 'object' ? 'info' : toastKind(message));
  el.dataset.kind = k;
  el.querySelector('.at-ico').innerHTML = TOAST_ICONS[k] || TOAST_ICONS.info;

  const bar = el.querySelector('.at-bar');
  el.classList.remove('show');
  bar.style.animation = 'none';
  void el.offsetWidth;
  bar.style.animation = `atBar ${ms}ms linear forwards`;
  el.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function formatTime(s) {
  if (!Number.isFinite(s) || s <= 0) return '00:00';
  const total = Math.floor(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const sec = (total % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

/* "[AWI] Darling in the FranXX - S01E22 [720p] [Multi-Audio]" -> { title, season, ep, tags } */
function parseMedia(fileName) {
  const base = String(fileName || '').replace(/\.(mp4|mkv|webm|avi|mov|ts|m4v)$/i, '');
  const tags = [];
  base.replace(/[\[(]([^\])]{2,40})[\])]/g, (m, inner) => {
    if (/\d{3,4}p|audio|dub|\bsubs?\b|hevc|x26[45]|10.?bit|web|bd|blu|hdr/i.test(inner) && !/^\s*s\d+\s*e\d+\s*$/i.test(inner)) tags.push(inner.trim());
    return m;
  });
  let s = base.replace(/[._]+/g, ' ');
  let season = null, ep = null, m;
  if ((m = /(?:^|[\s\[(])S(\d{1,2})\s*[ .\-]?E(?:P)?\s?(\d{1,4})(?=$|[\s\])\-])/i.exec(s)) || (m = /(?:^|[\s\[(])(\d{1,2})x(\d{2,4})(?=$|[\s\])])/i.exec(s))) {
    season = +m[1]; ep = +m[2]; s = s.replace(m[0], ' ');
  } else if ((m = /(?:^|[\s\[(\-])(?:episode|ep|e)\s*\.?\s*(\d{1,4})(?=$|[\s\])\-])/i.exec(s))) {
    ep = +m[1]; s = s.replace(m[0], ' ');
  } else if ((m = /\s-\s(\d{1,4})(?:v\d)?(?=\s|\[|\(|$)/.exec(s))) {
    ep = +m[1]; s = s.replace(m[0], ' ');
  }
  let title = s.replace(/\[.*?\]|\(.*?\)/g, ' ')
    .replace(/(\b1080p|\b720p|\b480p|AMZN|WEB-DL|\bAAC\b|H264|H\.264|x264|HEVC|x265|Multi Audio|Multimovies).*/i, '')
    .replace(/[\[\]()]/g, ' ').replace(/\s[-\u2013:]\s/g, ' ').replace(/[\s\-\u2013:]+$/g, '').replace(/^[\s\-\u2013:]+/g, '').replace(/\s+/g, ' ').trim();
  if (!title) title = base.replace(/[\[\]()._]+/g, ' ').replace(/\s+/g, ' ').trim();
  return { title, season, ep, tags };
}
function cleanMediaTitle(fileName) {
  if (!fileName) return 'Unknown Title';
  const p = parseMedia(fileName);
  const pad = (n) => String(n).padStart(2, '0');
  const label = p.ep == null ? '' : (p.season != null ? ` \u00b7 S${pad(p.season)}E${pad(p.ep)}` : ` \u00b7 Ep ${p.ep}`);
  return (p.title || 'Unknown Title') + label;
}

// Real duration in seconds, or 0 when unknown (fragmented MP4 reports Infinity).
function getDuration() {
  // the app's player (ExoPlayer) reports the real length; file metadata is only the fallback
  const nd = window.AstraNative ? video.duration : NaN;
  const d = (Number.isFinite(nd) && nd > 0) ? nd : (currentExplicitDuration || video.duration);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

// Playback position in the original file (transcoded streams restart at 0).
function absoluteTime() {
  return isTranscodingMode ? (transcodeBaseOffset + video.currentTime) : video.currentTime;
}

/* ------------------------------------------------------------------ */
/* Web Audio (A/V offset + EQ)                                         */
/* ------------------------------------------------------------------ */
// Once a media element is routed through Web Audio it is silent while the
// AudioContext is suspended, so every user gesture / play event resumes it.
function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
}
['pointerdown', 'keydown', 'touchend'].forEach((evt) => {
  document.addEventListener(evt, resumeAudio, { passive: true });
});

// The Web Audio chain (delay + EQ) costs CPU on every audio frame, so it is only built when it is really used.
/* ===== Sound engine: 5-band equalizer, bass boost, virtualizer, reverb ===== */
const EQ_BANDS = [60, 230, 910, 3600, 14000];
const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0], normal: [3, 0, 0, 0, 3], classical: [5, 3, -2, 4, 4], dance: [6, 0, 2, 4, 1],
  pop: [-1, 2, 5, 1, -2], rock: [5, 3, -1, 3, 5], jazz: [4, 2, -2, 2, 5], hiphop: [5, 3, 0, 1, 3],
  bass: [8, 5, 0, -1, -2], vocal: [-3, -1, 4, 4, 1], cinema: [5, 2, -1, 3, 4]
};
const EQ_PRESET_NAMES = {
  custom: 'Custom', flat: 'Flat', normal: 'Normal', classical: 'Classical', dance: 'Dance', pop: 'Pop',
  rock: 'Rock', jazz: 'Jazz', hiphop: 'Hip Hop', bass: 'Bass', vocal: 'Vocal', cinema: 'Cinema'
};
// Short impulses only: long convolution is heavy on weak phones
const REVERBS = { none: null, room: { sec: 0.5, decay: 3 }, hall: { sec: 1.6, decay: 2.5 }, plate: { sec: 1.0, decay: 4 } };
const fxImpulses = {};

function fxImpulse(key) {
  if (fxImpulses[key]) return fxImpulses[key];
  const cfg = REVERBS[key], rate = audioCtx.sampleRate, len = Math.max(1, Math.floor(rate * cfg.sec));
  const buf = audioCtx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, cfg.decay);
  }
  return (fxImpulses[key] = buf);
}

function eqActive() {
  return eqOn && (eqBands.some(Boolean) || eqBoost > 0 || eqVirt > 0 || eqReverb !== 'none');
}

function initWebAudio(force) {
  if (window.AstraNative) return;   // app: audio comes from the native player
  if (audioCtx) { resumeAudio(); return; }
  if (!force && !currentAudioOffset && !eqActive()) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioSrcNode = audioCtx.createMediaElementSource(video);

    delayNode = audioCtx.createDelay(10.0);
    delayNode.delayTime.value = Math.max(0, currentAudioOffset);

    eqNodes = EQ_BANDS.map((f, i) => {
      const n = audioCtx.createBiquadFilter();
      n.type = i === 0 ? 'lowshelf' : (i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking');
      n.frequency.value = f;
      if (n.type === 'peaking') n.Q.value = 1;
      n.gain.value = 0;
      return n;
    });
    eqBoostNode = audioCtx.createBiquadFilter();
    eqBoostNode.type = 'lowshelf';
    eqBoostNode.frequency.value = 140;
    eqBoostNode.gain.value = 0;

    fxSplit = audioCtx.createChannelSplitter(2);
    fxMerge = audioCtx.createChannelMerger(2);
    fxGain = { ll: audioCtx.createGain(), rl: audioCtx.createGain(), lr: audioCtx.createGain(), rr: audioCtx.createGain() };
    fxDry = audioCtx.createGain();
    fxWet = audioCtx.createGain(); fxWet.gain.value = 0;
    fxMaster = audioCtx.createGain();

    let prev = audioSrcNode;
    [delayNode, ...eqNodes, eqBoostNode, fxSplit].forEach((n) => { prev.connect(n); prev = n; });
    fxSplit.connect(fxGain.ll, 0); fxSplit.connect(fxGain.lr, 0);   // left channel
    fxSplit.connect(fxGain.rl, 1); fxSplit.connect(fxGain.rr, 1);   // right channel
    fxGain.ll.connect(fxMerge, 0, 0); fxGain.rl.connect(fxMerge, 0, 0);
    fxGain.lr.connect(fxMerge, 0, 1); fxGain.rr.connect(fxMerge, 0, 1);
    fxMerge.connect(fxDry); fxDry.connect(fxMaster);
    fxWet.connect(fxMaster);
    fxMaster.connect(audioCtx.destination);
    applyAudioFx();
  } catch (e) {
    console.error('Audio effects failed', e);
    // never leave the video silent if the graph could not be built
    try { audioSrcNode.disconnect(); audioSrcNode.connect(audioCtx.destination); } catch (_) {}
  }
  resumeAudio();
}

function applyAudioFx() {
  if (window.AstraNative) { if (window.astraNativeFx) window.astraNativeFx({ on: eqOn, bands: eqBands.slice(), boost: eqBoost, virt: eqVirt, reverb: eqReverb }); return; }
  if (!audioCtx || !fxMaster) return;
  const t = audioCtx.currentTime, on = eqOn;
  eqNodes.forEach((n, i) => n.gain.setTargetAtTime(on ? eqBands[i] : 0, t, 0.02));
  const boostDb = on ? (eqBoost / 100) * 12 : 0;
  eqBoostNode.gain.setTargetAtTime(boostDb, t, 0.02);

  // Virtualizer = stereo widening (mid/side). k = 1 leaves the sound untouched.
  const k = on ? 1 + (eqVirt / 100) * 1.8 : 1, a = (1 + k) / 2, b = (1 - k) / 2;
  fxGain.ll.gain.setTargetAtTime(a, t, 0.02); fxGain.rr.gain.setTargetAtTime(a, t, 0.02);
  fxGain.lr.gain.setTargetAtTime(b, t, 0.02); fxGain.rl.gain.setTargetAtTime(b, t, 0.02);

  // Reverb: the convolver is only connected while a reverb is selected
  const rv = on ? REVERBS[eqReverb] : null;
  if (rv) {
    if (!fxConv || fxConv._key !== eqReverb) {
      if (fxConv) { try { fxMerge.disconnect(fxConv); } catch (_) {} try { fxConv.disconnect(); } catch (_) {} }
      fxConv = audioCtx.createConvolver();
      fxConv.buffer = fxImpulse(eqReverb);
      fxConv._key = eqReverb;
      fxConvWired = false;
    }
    if (!fxConvWired) { fxMerge.connect(fxConv); fxConv.connect(fxWet); fxConvWired = true; }
    fxWet.gain.setTargetAtTime(0.4, t, 0.05);
    fxDry.gain.setTargetAtTime(0.85, t, 0.05);
  } else {
    fxWet.gain.setTargetAtTime(0, t, 0.05);
    fxDry.gain.setTargetAtTime(1, t, 0.05);
    if (fxConv && fxConvWired) {
      setTimeout(() => {
        if (REVERBS[eqReverb] && eqOn) return;
        try { fxMerge.disconnect(fxConv); } catch (_) {}
        fxConvWired = false;
      }, 400);
    }
  }

  // Headroom so boosted sound does not clip
  const peak = on ? Math.max(0, ...eqBands) : 0, virtDb = on ? (eqVirt / 100) * 3 : 0;
  const head = Math.min(14, (peak + boostDb) * 0.6 + virtDb);
  fxMaster.gain.setTargetAtTime(Math.pow(10, -head / 20), t, 0.03);
}

const rngAudioOffset = $('rngAudioOffset');
function paintAudioOffset() {
  const v = currentAudioOffset;
  if (rngAudioOffset) rngAudioOffset.value = v;
  const inp = $('audioSyncVal'); if (inp && document.activeElement !== inp) inp.value = `${v.toFixed(2)} s`;
  $('lblAudioOffset').textContent = `${v.toFixed(2)}s`;
  document.querySelectorAll('#audioChips .chip-preset').forEach((c) => c.classList.toggle('active', Math.abs(parseFloat(c.dataset.ms) - v) < 0.001));
  try { rngAudioOffset && typeof syncRanges === 'function' && syncRanges(); } catch (e) {}
}
function setAudioOffset(v, save) {
  v = Math.min(5, Math.max(0, Math.round((parseFloat(v) || 0) * 100) / 100));
  currentAudioOffset = v;
  if (v > 0) initWebAudio(true);
  if (delayNode) delayNode.delayTime.value = v;
  paintAudioOffset();
  if (save !== false) saveCurrentSettings();
}
if (rngAudioOffset) {
  rngAudioOffset.addEventListener('input', (e) => setAudioOffset(e.target.value));
  const inp = $('audioSyncVal');
  inp.addEventListener('focus', () => { inp.select(); });
  const commit = () => { setAudioOffset(String(inp.value).replace(',', '.').replace(/[^0-9.\-]/g, '')); inp.value = `${currentAudioOffset.toFixed(2)} s`; };
  inp.addEventListener('change', commit);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
  $('audioSyncReset').onclick = () => setAudioOffset(0);
  $('audioChips').addEventListener('click', (e) => { const c = e.target.closest('.chip-preset'); if (c) setAudioOffset(c.dataset.ms); });
  if (window.AstraNative) {
    $('audioSyncNote').textContent = 'Not available in the app player yet: it only works when the video plays in the browser player.';
    rngAudioOffset.closest('.card').classList.add('is-off');
  }
  paintAudioOffset();
}

/* ===== Theme sliders: fill + stepper buttons ===== */
function setRangeFill(r) {
  const min = parseFloat(r.min) || 0, max = parseFloat(r.max);
  const span = (isNaN(max) ? 100 : max) - min;
  const p = span ? (parseFloat(r.value) - min) / span : 0;
  const dv = parseFloat(r.dataset.zero != null ? r.dataset.zero : r.defaultValue);
  let z = span && !isNaN(dv) ? (dv - min) / span : 0;
  if (!(z > 0.02 && z < 0.98)) z = 0;              // neutral point at the start: normal fill
  r.style.setProperty('--p', p.toFixed(4));
  r.style.setProperty('--lo', Math.min(p, z).toFixed(4));
  r.style.setProperty('--hi', Math.max(p, z).toFixed(4));
}
function syncRanges() { document.querySelectorAll('input.custom-range').forEach(setRangeFill); }
function stepRange(r, dir) {
  if (dir > 0) r.stepUp(); else r.stepDown();
  r.dispatchEvent(new Event('input', { bubbles: true }));
  r.dispatchEvent(new Event('change', { bubbles: true }));
}
function makeStepBtn(r, dir) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'rng-btn';
  b.textContent = dir > 0 ? '+' : '−';
  b.setAttribute('aria-label', dir > 0 ? 'Increase' : 'Decrease');
  b.onclick = () => stepRange(r, dir);
  return b;
}
document.addEventListener('input', (e) => {
  if (e.target && e.target.matches && e.target.matches('input.custom-range')) setRangeFill(e.target);
}, true);
new MutationObserver(() => { if (settingsModal.classList.contains('open')) syncRanges(); })
  .observe(settingsModal, { attributes: true, attributeFilter: ['class'] });

/* ===== Round knob (Bass Boost / Virtualizer) ===== */
function makeKnob(el, label, onChange) {
  const R = 48, C = 60;
  const pt = (deg) => { const r = deg * Math.PI / 180; return [C + R * Math.cos(r), C + R * Math.sin(r)]; };
  const [sx, sy] = pt(135), [ex, ey] = pt(405);
  el.classList.add('knob');
  el.tabIndex = 0;
  el.setAttribute('role', 'slider');
  el.setAttribute('aria-label', label);
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '100');
  el.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="k-disc" cx="60" cy="60" r="40"/>' +
    '<path class="k-bg" d="M' + sx + ' ' + sy + ' A' + R + ' ' + R + ' 0 1 1 ' + ex + ' ' + ey + '"/>' +
    '<path class="k-fg" d=""/><circle class="k-dot" r="7" cx="' + sx + '" cy="' + sy + '"/></svg>' +
    '<div class="knob-center"><b class="knob-val">0%</b><span class="knob-lbl">' + label + '</span></div>';
  const fg = el.querySelector('.k-fg'), dot = el.querySelector('.k-dot'), txt = el.querySelector('.knob-val');
  let value = 0;
  function paint(v) {
    value = clamp(Math.round(v), 0, 100);
    const ang = 270 * value / 100, p = pt(135 + ang);
    fg.setAttribute('d', ang < 1 ? '' : 'M' + sx + ' ' + sy + ' A' + R + ' ' + R + ' 0 ' + (ang > 180 ? 1 : 0) + ' 1 ' + p[0] + ' ' + p[1]);
    dot.setAttribute('cx', p[0]); dot.setAttribute('cy', p[1]);
    txt.textContent = value + '%';
    el.setAttribute('aria-valuenow', String(value));
  }
  function fromPointer(e) {
    const r = el.getBoundingClientRect();
    const deg = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    let a = (deg - 135 + 360) % 360;
    if (a > 270) a = a < 315 ? 270 : 0;     // gap at the bottom snaps to the nearest end
    paint(a / 270 * 100);
    onChange(value);
  }
  let drag = false;
  el.addEventListener('pointerdown', (e) => { drag = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} fromPointer(e); });
  el.addEventListener('pointermove', (e) => { if (drag) fromPointer(e); });
  const end = () => { drag = false; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', (e) => {
    const d = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 5 : (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ? -5 : 0;
    if (!d) return;
    e.preventDefault(); paint(value + d); onChange(value);
  });
  paint(0);
  return { set: paint };
}

/* ===== Equalizer UI ===== */
let eqKnobBoost = null, eqKnobVirt = null;
const eqHz = (f) => (f >= 1000 ? (f / 1000) + 'k' : f) + ' Hz';

function syncEqUi() {
  setTimeout(() => { try { syncRanges(); } catch (e) {} }, 0);
  EQ_BANDS.forEach((f, i) => {
    const r = $('eqBand' + i);
    if (r) { r.value = eqBands[i]; setRangeFill(r); }
    const v = $('eqVal' + i);
    if (v) v.textContent = eqBands[i] + ' dB';
  });
  document.querySelectorAll('[data-eqp]').forEach((b) => b.classList.toggle('active', b.dataset.eqp === eqPreset));
  const on = $('eqOn');
  if (on) on.checked = eqOn;
  if ($('lblEqOn')) $('lblEqOn').textContent = eqOn ? 'On' : 'Off';
  if ($('eqCard')) $('eqCard').classList.toggle('off', !eqOn);
  if ($('eqReverb')) $('eqReverb').value = eqReverb;
  if (eqKnobBoost) eqKnobBoost.set(eqBoost);
  if (eqKnobVirt) eqKnobVirt.set(eqVirt);
}

function eqChanged() {
  initWebAudio(true);
  applyAudioFx();
  syncEqUi();
  saveCurrentSettings();
}

function buildEqUi() {
  const bands = $('eqBands'), presets = $('eqPresets');
  if (!bands || !presets) return;

  presets.innerHTML = '';
  Object.keys(EQ_PRESET_NAMES).forEach((k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip-preset'; b.dataset.eqp = k; b.textContent = EQ_PRESET_NAMES[k];
    b.onclick = () => {
      if (k !== 'custom') eqBands = EQ_PRESETS[k].slice();
      eqPreset = k;
      eqChanged();
    };
    presets.appendChild(b);
  });

  bands.innerHTML = '';
  EQ_BANDS.forEach((f, i) => {
    const col = document.createElement('div');
    col.className = 'vsl';
    col.innerHTML = '<span class="vsl-val" id="eqVal' + i + '">0 dB</span>' +
      '<div class="vsl-wrap"><input type="range" class="custom-range" id="eqBand' + i + '" min="-12" max="12" step="1" value="0" aria-label="' + eqHz(f) + ' gain"></div>' +
      '<span class="vsl-hz">' + eqHz(f) + '</span>';
    const r = col.querySelector('input');
    col.insertBefore(makeStepBtn(r, 1), col.querySelector('.vsl-wrap'));
    col.insertBefore(makeStepBtn(r, -1), col.querySelector('.vsl-hz'));
    r.addEventListener('input', () => {
      eqBands[i] = parseInt(r.value, 10) || 0;
      eqPreset = 'custom';
      eqChanged();
    });
    bands.appendChild(col);
  });

  if ($('eqOn')) $('eqOn').addEventListener('change', (e) => { eqOn = e.target.checked; eqChanged(); });
  if ($('eqReverb')) $('eqReverb').addEventListener('change', (e) => { eqReverb = e.target.value; eqChanged(); });
  if ($('knobBoost')) eqKnobBoost = makeKnob($('knobBoost'), 'Bass Boost', (v) => { eqBoost = v; eqChanged(); });
  if ($('knobVirt')) eqKnobVirt = makeKnob($('knobVirt'), 'Virtualizer', (v) => { eqVirt = v; eqChanged(); });
  syncEqUi();
}

// Older code / saved data used a 2-band bass + treble model
function applyEq(bass, treble, preset) {
  eqBands[0] = clamp(Math.round(Number(bass) || 0), -12, 12);
  eqBands[4] = clamp(Math.round(Number(treble) || 0), -12, 12);
  eqPreset = EQ_PRESET_NAMES[preset] ? preset : 'custom';
  applyAudioFx(); syncEqUi();
}

function eqSettings() {
  return { eqOn, eqBands: eqBands.slice(), eqBoost, eqVirt, eqReverb, eqPreset };
}

function loadEqFromSaved(s) {
  if (Array.isArray(s.eqBands) && s.eqBands.length === EQ_BANDS.length) {
    eqBands = s.eqBands.map((v) => clamp(Math.round(Number(v) || 0), -12, 12));
  } else {
    eqBands = [0, 0, 0, 0, 0];
    eqBands[0] = clamp(Math.round(Number(s.eqBass) || 0), -12, 12);
    eqBands[4] = clamp(Math.round(Number(s.eqTreble) || 0), -12, 12);
  }
  eqOn = s.eqOn !== false;
  eqBoost = clamp(Math.round(Number(s.eqBoost) || 0), 0, 100);
  eqVirt = clamp(Math.round(Number(s.eqVirt) || 0), 0, 100);
  eqReverb = REVERBS[s.eqReverb] !== undefined ? s.eqReverb : 'none';
  eqPreset = EQ_PRESET_NAMES[s.eqPreset] ? s.eqPreset : 'custom';
  applyAudioFx(); syncEqUi();
}

buildEqUi();
syncRanges();

const btnToggleSubStylePanel = $('btnToggleSubStylePanel');
function setSubStylePage(open) {
  const m = $('settingsModal'), p = $('subStylePage');
  if (!m || !p) return;
  m.classList.toggle('sub-open', open);
  p.setAttribute('aria-hidden', open ? 'false' : 'true');
  const body = p.querySelector('.sub-page-body'); if (open && body) body.scrollTop = 0;
}
if (btnToggleSubStylePanel) btnToggleSubStylePanel.onclick = () => setSubStylePage(true);
$('subStyleBack').onclick = () => setSubStylePage(false);
// Closing the menu always returns it to the main tabs
new MutationObserver(() => { if (!$('settingsModal').classList.contains('open')) setSubStylePage(false); }).observe($('settingsModal'), { attributes: true, attributeFilter: ['class'] });

/* ------------------------------------------------------------------ */
/* Playback state / history sync                                       */
/* ------------------------------------------------------------------ */
function savePlaybackState() {
  if (!activeVideoPath) return;
  const state = {
    relPath: activeVideoPath,
    title: playerCurrentTitle.textContent,
    folderTokens: currentPathTokens,
    time: absoluteTime(),
    duration: getDuration(),
    audioTrack: activeAudioStreamIndex,
    is10Bit: isCurrentFile10Bit
  };
  lsSet('astra_active_playback_state', JSON.stringify(state));
}

function notifyStreamPause() {
  if (isTranscodingMode) {
    fetch('/api/stream/pause?sid=' + TC_SID, { method: 'POST' }).catch(() => {});
  }
}

function notifyStreamResume() {
  if (isTranscodingMode) {
    fetch('/api/stream/resume?sid=' + TC_SID, { method: 'POST' }).catch(() => {});
  }
}

async function syncHistoryToServer(relPath, name, time, dur) {
  if (!name && !relPath) return;
  const t = Number.isFinite(time) ? Math.floor(time) : 0;
  const d = Number.isFinite(dur) ? Math.floor(dur) : 0;
  const keyForCache = relPath || activeVideoPath;
  if (keyForCache && d > 0) {
    historyCache[keyForCache] = {
      name: name || playerCurrentTitle.textContent, relPath: keyForCache, time: t, dur: d,
      percent: Math.min(100, Math.floor((t / d) * 100)), updated: Date.now()
    };
  }
  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        relPath: relPath || activeVideoPath,
        name: name || playerCurrentTitle.textContent,
        time: t,
        dur: d
      })
    });
  } catch (e) {}
}

function triggerAutoPause() {
  if (video && !video.paused) {
    video.pause();
    notifyStreamPause();
    if (activeVideoPath) {
      savePlaybackState();
      syncHistoryToServer(activeVideoPath, playerCurrentTitle.textContent, absoluteTime(), getDuration());
    }
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { triggerAutoPause(); return; }
  fetch('/api/profile', { cache: 'no-store' }).then((r) => r.json()).then((d) => {          // pick up changes made on another device
    if (!syncMerge(d.keys || {})) return;
    try { Object.assign(prefs, JSON.parse(localStorage.getItem('astra_prefs') || '{}')); initPrefsPanel(); loadSavedSettings(); renderSavedFilters(); showToast('Settings updated from another device', 2500); } catch (e) {}
  }).catch(() => {});
});
window.addEventListener('blur', () => { if (document.hidden) triggerAutoPause(); });
window.addEventListener('pagehide', triggerAutoPause);

/* ------------------------------------------------------------------ */
/* Saved settings                                                      */
/* ------------------------------------------------------------------ */
const SUB_EXTRA = { subRadius: 'rngSubRadius', subPad: 'rngSubPad', subLine: 'rngSubLine', subSpace: 'rngSubSpace', subTextOp: 'rngSubTextOp', subShBlur: 'rngSubShBlur', subShadowCol: 'colSubShadow' };
const SUB_HEX = { colSubText: 'hexSubText', colSubBorder: 'hexSubBorder', colSubBgCol: 'hexSubBgCol', colSubShadow: 'hexSubShadow' };
function subSyncHex() { Object.entries(SUB_HEX).forEach(([c, t]) => { if ($(c) && $(t)) $(t).value = $(c).value; }); }
function subRgb(hex) { return [1, 3, 5].map((i) => parseInt((hex || '#000000').slice(i, i + 2), 16) || 0); }
function loadSavedSettings() {
  try {
    const saved = JSON.parse(lsGet('astra_user_settings') || '{}') || {};
    if (saved.subSize) $('rngSubSize').value = saved.subSize;
    if (saved.subScale) $('rngSubScale').value = saved.subScale;
    if (saved.subBold !== undefined) $('chkSubBold').checked = saved.subBold;
    if (saved.subShadow !== undefined) $('chkSubShadow').checked = saved.subShadow;
    if (saved.subBorder !== undefined) $('chkSubBorder').checked = saved.subBorder;
    if (saved.subBg !== undefined) $('chkSubBg').checked = saved.subBg;
    if (saved.subTextColor) $('colSubText').value = saved.subTextColor;
    if (saved.subBorderColor) $('colSubBorder').value = saved.subBorderColor;
    if (saved.subFont !== undefined) $('selSubFont').value = saved.subFont;
    if (saved.subOutline !== undefined) $('rngSubOutline').value = saved.subOutline;
    if (saved.subBgOp !== undefined) $('rngSubBgOp').value = saved.subBgOp;
    if (saved.subBgCol) $('colSubBgCol').value = saved.subBgCol;
    if (saved.subPos !== undefined) $('rngSubPos').value = saved.subPos;
    Object.entries(SUB_EXTRA).forEach(([k, id]) => { if (saved[k] !== undefined && $(id)) $(id).value = saved[k]; });
    subSyncHex();

    if (saved.sharpness !== undefined) {
      $('sharpStrength').value = saved.sharpness;
      currentSharpness = parseFloat(saved.sharpness) / 100;
      $('lblSharp').textContent = saved.sharpness > 0 ? `${saved.sharpness}%` : 'Off';
    }
    if (saved.bright !== undefined) $('rngBright').value = saved.bright;
    if (saved.contrast !== undefined) $('rngContrast').value = saved.contrast;
    if (saved.sat !== undefined) $('rngSat').value = saved.sat;
    if (saved.hue !== undefined) $('rngHue').value = saved.hue;
    if (saved.warm !== undefined) $('rngWarm').value = saved.warm;

    if (saved.audioOffset !== undefined && rngAudioOffset) {
      currentAudioOffset = Math.min(5, Math.max(0, parseFloat(saved.audioOffset) || 0));
      if (typeof paintAudioOffset === 'function') paintAudioOffset(); else rngAudioOffset.value = currentAudioOffset;
    }

    if (saved.eqBands || saved.eqBass !== undefined || saved.eqTreble !== undefined) {
      loadEqFromSaved(saved);
    }

    if (saved.preferredLang) {
      preferredDefaultLang = saved.preferredLang;
      document.querySelectorAll('[data-deflang]').forEach((b) => {
        b.classList.toggle('active', b.dataset.deflang === preferredDefaultLang);
      });
    }
    preferredSubLang = saved.subLang || '';
    if (saved.speed) setPlaybackSpeed(saved.speed, false);
    if (saved.volume !== undefined) video.volume = clamp(Number(saved.volume), 0, 1);
    if (saved.muted !== undefined) video.muted = !!saved.muted;
    syncVolIcon();
    try {
      if (saved.aiLang && [...aiUi.lang.options].some((o) => o.value === saved.aiLang)) aiUi.lang.value = saved.aiLang;
      if (saved.aiTr !== undefined) aiUi.tr.checked = !!saved.aiTr;
      if (saved.aiMode) setAiMode(saved.aiMode, false);
      if (saved.aiSongs !== undefined) aiUi.songs.checked = !!saved.aiSongs;
    } catch (e) {}
  } catch (e) {}
  updateSubtitleStyles();
  applyCombinedFilters();
}

function saveCurrentSettings() {
  const settings = {
    subSize: $('rngSubSize').value,
    subScale: $('rngSubScale').value,
    subBold: $('chkSubBold').checked,
    subShadow: $('chkSubShadow').checked,
    subBorder: $('chkSubBorder').checked,
    subBg: $('chkSubBg').checked,
    subTextColor: $('colSubText').value,
    subBorderColor: $('colSubBorder').value,
    subFont: $('selSubFont').value,
    subOutline: $('rngSubOutline').value,
    subBgOp: $('rngSubBgOp').value,
    subBgCol: $('colSubBgCol').value,
    subPos: $('rngSubPos').value,
    ...Object.fromEntries(Object.entries(SUB_EXTRA).map(([k, id]) => [k, $(id).value])),
    sharpness: $('sharpStrength').value,
    bright: $('rngBright').value,
    contrast: $('rngContrast').value,
    sat: $('rngSat').value,
    hue: $('rngHue').value,
    warm: $('rngWarm').value,
    audioOffset: currentAudioOffset,
    ...eqSettings(),
    preferredLang: preferredDefaultLang,
    subLang: preferredSubLang,
    speed: playbackSpeed,
    volume: video.volume,
    muted: video.muted
  };
  try { settings.filterChip = currentFilterKey(); } catch (e) { settings.filterChip = ''; }
  try { settings.aiLang = aiUi.lang.value; settings.aiTr = aiUi.tr.checked; settings.aiSongs = aiUi.songs.checked; settings.aiMode = aiMode; } catch (e) {}
  lsSet('astra_user_settings', JSON.stringify(settings));
}

document.querySelectorAll('[data-deflang]').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('[data-deflang]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    preferredDefaultLang = btn.dataset.deflang;
    saveCurrentSettings();
  };
});

/* ------------------------------------------------------------------ */
/* Subtitles                                                           */
/* ------------------------------------------------------------------ */
const SUB_FONTS = {
  '': '', sans: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: '"Courier New", ui-monospace, monospace',
  round: 'ui-rounded, "Varela Round", "Nunito", "Trebuchet MS", sans-serif', comic: '"Comic Sans MS", "Comic Neue", cursive', impact: 'Impact, "Arial Black", sans-serif', hand: '"Segoe Print", "Bradley Hand", cursive'
};
function updateSubtitleStyles() {
  const size = $('rngSubSize').value;
  const scale = $('rngSubScale').value;
  const isBold = $('chkSubBold').checked;
  const hasShadow = $('chkSubShadow').checked;
  const hasBorder = $('chkSubBorder').checked;
  const outline = parseFloat($('rngSubOutline').value) || 0;
  const bgOp = parseInt($('rngSubBgOp').value, 10) || 0;
  const textColor = $('colSubText').value;
  const borderColor = $('colSubBorder').value;
  const bgHex = $('colSubBgCol').value || '#000000';
  const rgb = [1, 3, 5].map((i) => parseInt(bgHex.slice(i, i + 2), 16));

  $('lblSubSize').textContent = `${size}px`;
  $('lblSubScale').textContent = `${scale}%`;
  $('lblSubOutline').textContent = outline ? `${outline}px` : 'Off';
  $('lblSubBgOp').textContent = bgOp ? `${bgOp}%` : 'Off';
  $('lblSubPos').textContent = `${$('rngSubPos').value}%`;

  const radius = $('rngSubRadius').value, pad = parseInt($('rngSubPad').value, 10) || 0;
  const lineH = $('rngSubLine').value, space = $('rngSubSpace').value, textOp = $('rngSubTextOp').value, shBlur = parseInt($('rngSubShBlur').value, 10) || 0;
  const sh = subRgb($('colSubShadow').value);
  $('lblSubRadius').textContent = `${radius}px`; $('lblSubPad').textContent = `${pad}px`; $('lblSubLine').textContent = lineH;
  $('lblSubSpace').textContent = `${space}px`; $('lblSubTextOp').textContent = `${textOp}%`; $('lblSubShBlur').textContent = `${shBlur}px`;
  const tc = subRgb(textColor);
  subDisplayBox.style.fontSize = `${size}px`;
  subDisplayBox.style.fontFamily = SUB_FONTS[$('selSubFont').value] || '';
  subDisplayBox.style.transform = `scale(${scale / 100})`;
  subDisplayBox.style.fontWeight = isBold ? '700' : '400';
  subDisplayBox.style.color = textOp < 100 ? `rgba(${tc[0]}, ${tc[1]}, ${tc[2]}, ${textOp / 100})` : textColor;
  subDisplayBox.style.lineHeight = lineH;
  subDisplayBox.style.letterSpacing = `${space}px`;
  // background lives on an inner inline span so it hugs each line of text instead of filling the whole box
  subDisplayBox.style.backgroundColor = 'transparent';
  subDisplayBox.style.padding = '0px';
  subDisplayBox.style.borderRadius = '0px';
  subDisplayBox.style.setProperty('--sub-bg', bgOp ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${bgOp / 100})` : 'transparent');
  subDisplayBox.style.setProperty('--sub-px', bgOp ? `${pad}px` : '0px');
  subDisplayBox.style.setProperty('--sub-py', bgOp ? `${Math.round(pad / 2)}px` : '0px');
  subDisplayBox.style.setProperty('--sub-r', bgOp ? `${radius}px` : '0px');
  subDisplayBox.style.webkitTextStroke = hasBorder && outline ? `${outline * 2}px ${borderColor}` : '0';
  subDisplayBox.style.paintOrder = 'stroke fill';
  subDisplayBox.style.textShadow = hasShadow ? `2px 2px ${shBlur}px rgba(${sh[0]}, ${sh[1]}, ${sh[2]}, 0.9), 0 0 ${shBlur * 2}px rgba(${sh[0]}, ${sh[1]}, ${sh[2]}, 0.8)` : 'none';
  if (typeof syncTopBoxStyle === 'function') syncTopBoxStyle();
  if (typeof syncSubLift === 'function') syncSubLift();
  saveCurrentSettings();
}

['rngSubRadius', 'rngSubPad', 'rngSubLine', 'rngSubSpace', 'rngSubTextOp', 'rngSubShBlur', 'colSubShadow', 'rngSubSize', 'rngSubScale', 'rngSubOutline', 'rngSubBgOp', 'rngSubPos', 'selSubFont', 'chkSubBold', 'chkSubShadow', 'chkSubBorder', 'chkSubBg', 'colSubText', 'colSubBorder', 'colSubBgCol'].forEach((id) => {
  const el = $(id);
  if (el) el.addEventListener('input', updateSubtitleStyles);
});
// colour picker <-> hex box stay in sync
Object.entries(SUB_HEX).forEach(([c, t]) => {
  $(c).addEventListener('input', () => { $(t).value = $(c).value; });
  const apply = () => {
    let v = $(t).value.trim();
    if (v && v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-fA-F]{3}$/.test(v)) v = '#' + v.slice(1).split('').map((x) => x + x).join('');
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { $(c).value = v.toLowerCase(); $(t).value = v.toLowerCase(); updateSubtitleStyles(); }
  };
  $(t).addEventListener('input', () => { if (/^#?[0-9a-fA-F]{6}$/.test($(t).value.trim())) apply(); });
  $(t).addEventListener('change', () => { apply(); $(t).value = $(c).value; });
});
$('btnSubStyleReset').onclick = () => {
  const d = { rngSubSize: 18, rngSubScale: 100, rngSubOutline: 1.5, rngSubBgOp: 0, rngSubPos: 0 };
  Object.entries(d).forEach(([k, v]) => { $(k).value = v; });
  $('selSubFont').value = ''; $('chkSubBold').checked = true; $('chkSubShadow').checked = true; $('chkSubBorder').checked = true;
  $('colSubText').value = '#ffffff'; $('colSubBorder').value = '#000000'; $('colSubBgCol').value = '#000000'; $('colSubShadow').value = '#000000';
  Object.entries({ rngSubRadius: 6, rngSubPad: 8, rngSubLine: 1.35, rngSubSpace: 0, rngSubTextOp: 100, rngSubShBlur: 4 }).forEach(([k, v]) => { $(k).value = v; });
  subSyncHex();
  updateSubtitleStyles();
};

// Where the bottom subtitle sits: user height + automatically above the control bar while it is visible.
function syncSubLift() {
  const pos = parseFloat($('rngSubPos').value) || 0;
  const wrap = $('playerWrapper');
  const h = wrap ? wrap.clientHeight : 0;
  const bar = $('bottomOverlay');
  const barUp = bar && !bar.classList.contains('hidden') && !wrap.classList.contains('is-locked') ? Math.max(0, bar.offsetHeight - 22) : 0;
  const px = Math.round(34 + (h * pos) / 100 + barUp);
  subDisplayBox.style.top = 'auto';
  subDisplayBox.style.bottom = `${px}px`;
}
// Cue text -> safe HTML. Only <i>, <b>, <u> survive; everything else is stripped/escaped.
function formatCueText(raw) {
  const noTags = raw.replace(/<(?!\/?[ibu]>)[^>]*>/gi, '');
  return noTags.split(/(<\/?[ibu]>)/i).map((part, i) => (
    i % 2
      ? part.toLowerCase()
      : part
        .replace(/&(?!(?:amp|lt|gt|nbsp|lrm|rlm|quot|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
  )).join('');
}

const subPosLayer = document.createElement('div');
subPosLayer.className = 'sub-pos-layer';
subDisplayBox.parentNode.insertBefore(subPosLayer, subDisplayBox.nextSibling);

// Top lines (second speaker, songs) get their own box so they can show together with the bottom line.
const subTopBox = subDisplayBox.cloneNode(false);
subTopBox.id = 'subTopBox';
subDisplayBox.parentNode.insertBefore(subTopBox, subDisplayBox);
function syncTopBoxStyle() {
  ['fontSize', 'fontFamily', 'transform', 'fontWeight', 'color', 'backgroundColor', 'padding', 'borderRadius', 'textShadow', 'webkitTextStroke', 'paintOrder', 'lineHeight', 'letterSpacing'].forEach((k) => { subTopBox.style[k] = subDisplayBox.style[k]; });
  ['--sub-bg', '--sub-px', '--sub-py', '--sub-r'].forEach((k) => subTopBox.style.setProperty(k, subDisplayBox.style.getPropertyValue(k)));
}
syncTopBoxStyle();

function hideSubtitle() {
  activeSubSignature = '';
  subDisplayBox.style.display = 'none';
  subDisplayBox.innerHTML = '';
  subTopBox.style.display = 'none';
  subTopBox.innerHTML = '';
  subPosLayer.textContent = '';
  assAnims.length = 0;
}

let activeSubSignature = '';
let lastSubCheck = 0;
const POS_RE = /^<pos:(-?[\d.]+),(-?[\d.]+),(\d),([\d.]*),([0-9a-f]*),([0-9a-f]*)>/i;

// Where the picture really is inside the player (it is letter-boxed), so ASS coordinates land on the picture.
function pictureRect() {
  const host = subPosLayer.parentNode;
  const W = host.clientWidth, H = host.clientHeight;
  const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
  const sc = Math.min(W / vw, H / vh);
  const w = vw * sc, h = vh * sc;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

/* ---- ASS engine renderer (v1.17): draws <ass:…> cues with positions, 9-grid anchors, fades, moves,
   \t transforms, karaoke and vector drawings (SVG), animated with the Web Animations API. ---- */
const ASS_RE = /^<ass:([A-Za-z0-9_-]+)>/;
const assAnims = [];                       // { a: Animation, cue }
function assDecode(raw) {
  const m = ASS_RE.exec(raw);
  if (!m) return null;
  try {
    const b = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))));
    return { info: JSON.parse(json), plain: raw.slice(m[0].length) };
  } catch (_) { return null; }
}
function assTimeline(info, key, start) {   // numeric \t timeline for one property: [[ms,value],...]
  const pts = [[0, start]]; let v = start;
  (info.tf || []).filter((t) => t.p[key] != null).sort((a, b) => a.t1 - b.t1).forEach((t) => {
    pts.push([t.t1, v]); pts.push([t.t2, t.p[key]]); v = t.p[key];
  });
  return pts.length > 1 ? pts : null;
}
function assAt(pts, ms) {
  if (ms <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (ms <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return t1 === t0 ? v1 : v0 + (v1 - v0) * (ms - t0) / (t1 - t0); }
  }
  return pts[pts.length - 1][1];
}
function renderAss(info, cue, rect, layer) {
  const [rx, ry] = info.r, kx = rect.w / rx, ky = rect.h / ry, b = info.base;
  const dur = Math.max(1, (cue.endTime - cue.startTime) * 1000);
  const an = info.an, colA = an % 3 === 1 ? 0 : an % 3 === 2 ? 1 : 2, rowA = an >= 7 ? 0 : an >= 4 ? 1 : 2;
  let ax, ay, maxW;
  if (info.pos) { ax = info.pos[0]; ay = info.pos[1]; maxW = rect.w; }
  else if (info.mv) { ax = info.mv[0]; ay = info.mv[1]; maxW = rect.w; }
  else {
    const [ml, mr, mv] = info.mr;
    ax = colA === 0 ? ml : colA === 1 ? (rx + ml - mr) / 2 : rx - mr;
    ay = rowA === 0 ? mv : rowA === 1 ? ry / 2 : ry - mv;
    maxW = Math.max(40, (rx - ml - mr) * kx);
  }
  const outer = document.createElement('div');
  outer.className = 'sub-ass';
  outer.style.left = `${rect.x + ax * kx}px`; outer.style.top = `${rect.y + ay * ky}px`;
  const fade = document.createElement('div'); fade.className = 'sub-ass-l';
  const rot = document.createElement('div'); rot.className = 'sub-ass-l';
  const box = document.createElement('div'); box.className = 'sub-ass-box';
  outer.appendChild(fade); fade.appendChild(rot); rot.appendChild(box);
  const px = (v) => `${v * ky}px`;
  const anims = [];
  const anim = (el, frames) => { try { const a = el.animate(frames, { duration: dur, fill: 'both', easing: 'linear' }); a.pause(); anims.push(a); } catch (_) { /* old browser: static */ } };

  box.style.transform = `translate(${-colA * 50}%, ${-rowA * 50}%)`;
  box.style.textAlign = colA === 0 ? 'left' : colA === 1 ? 'center' : 'right';
  box.style.maxWidth = `${maxW}px`;
  box.style.fontFamily = b.fn ? `"${b.fn}", "Noto Sans", Arial, sans-serif` : 'Arial, "Noto Sans", sans-serif';
  box.style.fontSize = px(b.fs || 48);
  box.style.color = `#${b.c1}`;
  if (b.b) box.style.fontWeight = '700';
  if (b.i) box.style.fontStyle = 'italic';
  box.style.textDecoration = [b.u ? 'underline' : '', b.s ? 'line-through' : ''].join(' ').trim() || 'none';
  const outline = `#${b.c3}`;
  if (info.box) { box.style.background = outline; box.style.padding = px(b.bord || 2); }
  else if (b.bord > 0) { box.style.webkitTextStroke = `${2 * b.bord * ky}px ${outline}`; box.style.paintOrder = 'stroke fill'; }
  if (b.shad > 0) box.style.textShadow = `${px(b.shad)} ${px(b.shad)} 0 rgba(0,0,0,.55)`;
  if (b.blur > 0 || (info.tf || []).some((t) => t.p.blur != null)) box.style.filter = `blur(${b.blur * ky * 0.6}px)`;
  if (b.a < 1) rot.style.opacity = String(b.a);

  // transform group on the rotation layer (origin = the anchor point)
  const frz = assTimeline(info, 'frz', b.frz), sx = assTimeline(info, 'sx', b.sx), sy = assTimeline(info, 'sy', b.sy);
  const tfm = (ms) => `rotate(${-(frz ? assAt(frz, ms) : b.frz)}deg) scale(${(sx ? assAt(sx, ms) : b.sx) / 100}, ${(sy ? assAt(sy, ms) : b.sy) / 100})`;
  rot.style.transformOrigin = '0 0';
  rot.style.transform = tfm(0);
  if (frz || sx || sy) {
    const ms = [...new Set([0, dur, ...[frz, sx, sy].filter(Boolean).flatMap((p) => p.map((q) => q[0]))])].filter((x) => x >= 0 && x <= dur).sort((a, c) => a - c);
    anim(rot, ms.map((t) => ({ offset: t / dur, transform: tfm(t) })));
  }
  const fs = assTimeline(info, 'fs', b.fs || 48);
  if (fs) anim(box, fs.map(([t, v]) => ({ offset: Math.min(1, t / dur), fontSize: px(v) })));
  const al = assTimeline(info, 'a', b.a);
  if (al) anim(rot, al.map(([t, v]) => ({ offset: Math.min(1, t / dur), opacity: v })));
  const bl = assTimeline(info, 'blur', b.blur);
  if (bl) anim(box, bl.map(([t, v]) => ({ offset: Math.min(1, t / dur), filter: `blur(${v * ky * 0.6}px)` })));
  const bo = assTimeline(info, 'bord', b.bord);
  if (bo && !info.box) anim(box, bo.map(([t, v]) => ({ offset: Math.min(1, t / dur), webkitTextStrokeWidth: `${2 * v * ky}px` })));
  const tc = (info.tf || []).filter((t) => t.p.c1).sort((a, c) => a.t1 - c.t1);
  if (tc.length) {
    const fr = [{ offset: 0, color: `#${b.c1}` }]; let last = b.c1;
    tc.forEach((t) => { fr.push({ offset: Math.min(1, t.t1 / dur), color: `#${last}` }, { offset: Math.min(1, t.t2 / dur), color: `#${t.p.c1}` }); last = t.p.c1; });
    fr.push({ offset: 1, color: `#${last}` });
    anim(box, fr);
  }
  if (info.fd) anim(fade, info.fd.map(([t, v]) => ({ offset: Math.min(1, t / dur), opacity: v })));
  if (info.mv) {
    const [x1, y1, x2, y2, t1, t2] = info.mv, L = (x) => `${rect.x + x * kx}px`, T = (y) => `${rect.y + y * ky}px`;
    anim(outer, [{ offset: 0, left: L(x1), top: T(y1) }, { offset: Math.min(1, t1 / dur), left: L(x1), top: T(y1) },
      { offset: Math.min(1, Math.max(t1, t2) / dur), left: L(x2), top: T(y2) }, { offset: 1, left: L(x2), top: T(y2) }]);
  }

  if (info.dr) {
    const d = info.dr, ns = 'http://www.w3.org/2000/svg', pad = (d.bord || 0) + 1;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `${d.x - pad} ${d.y - pad} ${d.w + 2 * pad} ${d.h + 2 * pad}`);
    svg.style.width = `${(d.w + 2 * pad) * kx}px`; svg.style.height = `${(d.h + 2 * pad) * ky}px`;
    svg.style.overflow = 'visible'; svg.style.display = 'block';
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d.d); p.setAttribute('fill', `#${d.c}`);
    if (d.bord > 0 && !info.box) { p.setAttribute('stroke', `#${d.o}`); p.setAttribute('stroke-width', String(d.bord * 2)); p.setAttribute('paint-order', 'stroke'); p.setAttribute('stroke-linejoin', 'round'); }
    svg.appendChild(p);
    box.style.webkitTextStroke = '0'; box.style.width = 'max-content';
    box.appendChild(svg);
  } else {
    (info.runs || []).forEach((r) => {
      const mk = (txt, extra) => {
        const sp = document.createElement('span'); sp.textContent = txt;
        if (r.c1) sp.style.color = `#${r.c1}`;
        if (r.fs) sp.style.fontSize = px(r.fs);
        if (r.fn) sp.style.fontFamily = `"${r.fn}", "Noto Sans", Arial, sans-serif`;
        if (r.b != null) sp.style.fontWeight = r.b ? '700' : '400';
        if (r.i != null) sp.style.fontStyle = r.i ? 'italic' : 'normal';
        if (r.u != null || r.s != null) sp.style.textDecoration = [(r.u != null ? r.u : b.u) ? 'underline' : '', (r.s != null ? r.s : b.s) ? 'line-through' : ''].join(' ').trim() || 'none';
        if (r.bord != null) sp.style.webkitTextStrokeWidth = `${2 * r.bord * ky}px`;
        if (extra) extra(sp);
        box.appendChild(sp); return sp;
      };
      if (r.k) {
        const [st, kd, ty] = r.k, after = `#${r.c1 || b.c1}`, before = `#${b.c2 || b.c1}`;
        const chars = ty === 'f' && r.t.length > 1 ? [...r.t] : [r.t];
        chars.forEach((ch, i) => mk(ch, (sp) => {
          const t0 = st + kd * i / chars.length, t1 = t0 + Math.max(1, kd / chars.length);
          sp.style.color = before;
          anim(sp, [{ offset: 0, color: before }, { offset: Math.min(1, t0 / dur), color: before }, { offset: Math.min(1, t1 / dur), color: after }, { offset: 1, color: after }]);
        }));
      } else mk(r.t);
    });
  }
  layer.appendChild(outer);
  anims.forEach((a) => assAnims.push({ a, cue }));
  return outer;
}
// keep every animation locked to the video clock (seek, pause, play)
// An SRT that spells a line out syllable by syllable (one tiny cue each, all on screen together) is one line, not a column.
function assMergeSyllables(list) {
  const groups = new Map(), out = [];
  list.forEach((it) => {
    const inf = it.info, r = inf.runs || [];
    const tiny = !inf.pos && !inf.mv && !inf.dr && r.length === 1 && r[0].t.length <= 6 && !/\n/.test(r[0].t);
    if (!tiny) { out.push(it); return; }
    const b = inf.base, key = [inf.an, b.c1, b.c3, b.fn, b.fs, b.b, r[0].c1, r[0].fs].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  });
  groups.forEach((g) => {
    if (g.length < 3) { out.push(...g); return; }
    g.sort((a, b) => a.cue.startTime - b.cue.startTime || a.i - b.i);
    const first = g[0], merged = { ...first, info: { ...first.info, runs: g.map((x) => ({ ...x.info.runs[0], t: x.info.runs[0].t + '\u200a' })) } };
    merged.n = g.length; out.push(merged);
  });
  return out.sort((a, b) => a.i - b.i);
}
function assSyncAnims() {
  if (!assAnims.length) return;
  const t = absoluteTime() - subDelay;
  for (const it of assAnims) {
    const ms = Math.max(0, (t - it.cue.startTime) * 1000);
    try {
      if (Math.abs((it.a.currentTime || 0) - ms) > 120 || video.paused) it.a.currentTime = ms;
      if (video.paused) { if (it.a.playState === 'running') it.a.pause(); } else if (it.a.playState !== 'running') it.a.play();
    } catch (_) { /* ignore */ }
  }
}

// Cues are matched against the position in the ORIGINAL file, so subtitles stay
// in sync after a seek in a transcoded stream (where video.currentTime restarts at 0).
function updateSubtitleDisplay() {
  const track = mainTrack && mainTrack.track;
  if (!subsOn || !track || !track.cues || track.cues.length === 0) {
    if (activeSubSignature !== '') hideSubtitle();
    return;
  }

  const t = absoluteTime() - subDelay;
  const cues = track.cues;
  let topText = '';
  let bottomText = '';
  const placed = [];
  const assList = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.startTime > t || cue.endTime <= t) continue;
    const raw = cue.text || '';
    const am = ASS_RE.test(raw) ? assDecode(raw) : null;
    const pm = am ? null : POS_RE.exec(raw);
    if (am) {
      assList.push({ cue, i, info: am.info });
    } else if (pm) {
      placed.push({ x: +pm[1], y: +pm[2], an: +pm[3], fs: pm[4] ? +pm[4] : 0, c1: pm[5], c3: pm[6], html: formatCueText(raw.slice(pm[0].length)) });
    } else if (raw.includes('<position:top>')) {
      topText += formatCueText(raw.replace(/<position:top>/g, '')) + '<br>';
    } else {
      bottomText += formatCueText(raw) + '<br>';
    }
  }

  if (assList.length > 2) { const m = assMergeSyllables(assList); assList.length = 0; assList.push(...m); }
  const rect = (placed.length || assList.length) ? pictureRect() : null;
  const signature = `${topText ? 'T' : 'B'}|${topText || bottomText}|${placed.map((p) => `${p.x},${p.y},${p.an},${p.fs},${p.c1},${p.html}`).join(';')}|${assList.map((a) => a.i + ':' + a.cue.startTime + ':' + (a.n || 1)).join(',')}|${rect ? Math.round(rect.w) + 'x' + Math.round(rect.h) : ''}`;
  syncSubLift();
  if (signature === activeSubSignature) { assSyncAnims(); return; }

  if (!topText && !bottomText && !placed.length && !assList.length) {
    hideSubtitle();
    return;
  }

  activeSubSignature = signature;
  subTopBox.style.bottom = 'auto'; subTopBox.style.top = '8%';
  const hug = (t) => (t ? `<span class="sub-hug">${t.replace(/(<br>)+$/, '')}</span>` : '');
  subTopBox.innerHTML = hug(topText);
  subTopBox.style.display = topText ? 'inline-block' : 'none';
  syncSubLift();
  subDisplayBox.innerHTML = hug(bottomText);
  subDisplayBox.style.display = bottomText ? 'inline-block' : 'none';

  subPosLayer.textContent = '';
  assAnims.length = 0;
  assList.forEach((a) => renderAss(a.info, a.cue, rect, subPosLayer));
  // lines without their own position that land on the same spot are stacked (bottom ones go up, top ones down)
  const flow = [...subPosLayer.querySelectorAll('.sub-ass')].filter((_, k) => !assList[k].info.pos && !assList[k].info.mv);
  for (let i = 1; i < flow.length; i++) {
    for (let pass = 0; pass < 8; pass++) {
      const r = flow[i].firstChild.firstChild.firstChild.getBoundingClientRect(); let moved = false;
      for (let j = 0; j < i; j++) {
        const o = flow[j].firstChild.firstChild.firstChild.getBoundingClientRect();
        if (r.left < o.right && r.right > o.left && r.top < o.bottom - 1 && r.bottom > o.top + 1) {
          const info = assList.filter((x) => !x.info.pos && !x.info.mv)[i].info;
          const dy = info.an < 7 ? -(r.bottom - o.top + 2) : (o.bottom - r.top + 2);
          flow[i].style.top = `${parseFloat(flow[i].style.top) + dy}px`; moved = true; break;
        }
      }
      if (!moved) break;
    }
  }
  assSyncAnims();
  placed.forEach((p) => {
    const el = document.createElement('span');
    el.className = 'sub-pos';
    el.innerHTML = p.html;
    const col = p.an % 3 === 1 ? 0 : p.an % 3 === 2 ? -50 : -100;      // left / centre / right anchor
    const row = p.an >= 7 ? 0 : p.an >= 4 ? -50 : -100;               // top / middle / bottom anchor
    el.style.left = `${rect.x + p.x / 100 * rect.w}px`;
    el.style.top = `${rect.y + p.y / 100 * rect.h}px`;
    el.style.transform = `translate(${col}%, ${row}%)`;
    el.style.fontSize = `${Math.max(10, (p.fs || 5) / 100 * rect.h)}px`;
    if (p.c1) el.style.color = `#${p.c1}`;
    const o = p.c3 ? `#${p.c3}` : '#000';
    el.style.textShadow = `-1px -1px 0 ${o}, 1px -1px 0 ${o}, -1px 1px 0 ${o}, 1px 1px 0 ${o}, 0 0 6px ${o}`;
    subPosLayer.appendChild(el);
  });
  // two lines wanting the same spot: stack them (bottom/middle anchors grow upward, top anchors downward) instead of overprinting
  const els = [...subPosLayer.querySelectorAll('.sub-pos')];
  for (let i = 1; i < els.length; i++) {
    for (let pass = 0; pass < 8; pass++) {
      const r = els[i].getBoundingClientRect(); let moved = false;
      for (let j = 0; j < i; j++) {
        const o = els[j].getBoundingClientRect();
        if (r.left < o.right && r.right > o.left && r.top < o.bottom - 1 && r.bottom > o.top + 1) {
          const up = placed[i].an < 7;
          const dy = up ? -(r.bottom - o.top + 2) : (o.bottom - r.top + 2);
          els[i].style.top = `${parseFloat(els[i].style.top) + dy}px`; moved = true; break;
        }
      }
      if (!moved) break;
    }
  }
}

function setupSubtitleCues() {
  if (!mainTrack || !mainTrack.track) return;
  mainTrack.track.mode = 'hidden';
  activeSubSignature = '\u0000';
  updateSubtitleDisplay();
}

mainTrack.addEventListener('load', () => { activeSubSignature = '\u0000'; updateSubtitleDisplay(); });
mainTrack.addEventListener('error', () => {
  if (subsOn) showToast('Subtitle could not be loaded');
});

function resetSubtitleState() {
  subsOn = false;
  mainTrack.removeAttribute('src');
  hideSubtitle();
}

function selectSubtitleUrl(url) {
  subsOn = true;
  if (window.astraSetSubs) {   // app: cues come from the native layer
    window.astraSetSubs(url).then(() => { activeSubSignature = '\u0000'; setupSubtitleCues(); }).catch((e) => showToast('Subtitle could not be loaded' + (e && e.message ? ': ' + e.message : ''), 4000, 'err'));
    return;
  }
  mainTrack.src = url;
  setupSubtitleCues();
}

function selectOptRow(container, row) {
  container.querySelectorAll('.opt-row').forEach((r) => r.classList.remove('selected'));
  row.classList.add('selected');
}

function buildSubtitleList(tracks, relPath) {
  subTrackList.innerHTML = '';

  const offRow = document.createElement('div');
  offRow.className = 'opt-row selected';
  offRow.textContent = 'Off';
  offRow.onclick = () => {
    selectOptRow(subTrackList, offRow);
    resetSubtitleState();
    preferredSubLang = '';
    vpSet(relPath, { sub: 'off' });
    saveCurrentSettings();
  };
  subTrackList.appendChild(offRow);

  const vp = vpGet(relPath);
  const forcedTrack = vp.sub && vp.sub.startsWith('t:') ? vp.sub.slice(2) : null;
  let autoChoose = null;
  tracks.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'opt-row';
    row.textContent = `${s.title} (${String(s.codec || '').toUpperCase()})`;

    const choose = (silent) => {
      selectOptRow(subTrackList, row);
      preferredSubLang = s.lang && s.lang !== 'und' ? s.lang : '';
      if (!silent) vpSet(relPath, { sub: `t:${s.streamIndex}` });
      saveCurrentSettings();
      if (!silent) showToast('Loading subtitle…', 1500);
      selectSubtitleUrl(`/api/subs/stream?file=${encodeURIComponent(relPath)}&trackIndex=${s.streamIndex}`);
    };
    row.onclick = () => choose(false);
    subTrackList.appendChild(row);

    // Keep the subtitle language chosen on the previous episode.
    if (forcedTrack !== null) { if (String(s.streamIndex) === forcedTrack) autoChoose = choose; }
    else if (vp.sub !== 'off' && !(vp.sub || '').startsWith('ai') && !autoChoose && preferredSubLang && s.lang === preferredSubLang) autoChoose = choose;
  });

  if (autoChoose) autoChoose(true);
  aiOnEpisodeLoaded();
}

function addExternalSubtitle(name, fullPath) {
  const url = `/api/subs/file?path=${encodeURIComponent(fullPath)}`;
  let row = Array.from(subTrackList.querySelectorAll('.opt-row')).find((r) => r.dataset.extPath === fullPath);
  if (!row) {
    row = document.createElement('div');
    row.className = 'opt-row';
    row.textContent = `External: ${name}`;
    row.dataset.extPath = fullPath;
    const target = row;
    row.onclick = () => {
      selectOptRow(subTrackList, target);
      selectSubtitleUrl(url);
      vpSet(activeVideoPath, { sub: `f:${fullPath}` });
    };
    subTrackList.appendChild(row);
  }
  selectOptRow(subTrackList, row);
  selectSubtitleUrl(url);
  vpSet(activeVideoPath, { sub: `f:${fullPath}` });
}

/* ------------------------------------------------------------------ */
/* WebGL renderer (sharpening) with plain <video> fallback             */
/* ------------------------------------------------------------------ */
let gl = null;
try {
  gl = glCanvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
} catch (e) { gl = null; }
let glProgram, texture, sharpLoc, texelLoc;
let glReady = false;
let glDirty = true;
let currentSharpness = 0.0;
let displayEl = glCanvas;
let glFallback = false;

const vsSource = `
  attribute vec2 a_pos;
  varying vec2 v_tex;
  void main() {
    v_tex = vec2(a_pos.x * 0.5 + 0.5, 1.0 - (a_pos.y * 0.5 + 0.5));
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const fsSource = `
  precision mediump float;
  varying vec2 v_tex;
  uniform sampler2D u_image;
  uniform float u_sharpness;
  uniform vec2 u_texel;
  void main() {
    vec2 step = u_texel;
    vec4 col = texture2D(u_image, v_tex);
    vec4 n = texture2D(u_image, v_tex + vec2(0.0, -step.y));
    vec4 s = texture2D(u_image, v_tex + vec2(0.0, step.y));
    vec4 e = texture2D(u_image, v_tex + vec2(step.x, 0.0));
    vec4 w = texture2D(u_image, v_tex + vec2(-step.x, 0.0));
    vec4 edge = 4.0 * col - n - s - e - w;
    gl_FragColor = clamp(col + edge * u_sharpness, 0.0, 1.0);
  }
`;

function useVideoFallback() {
  // No usable WebGL: show the <video> element directly (sharpness is unavailable).
  glReady = false; glFallback = true;
  glCanvas.style.display = 'none';
  video.style.display = 'block';
  video.classList.add('gl-viewport', 'aspect-contain');
  displayEl = video;
  video.style.filter = glCanvas.style.filter; // carry current filter over (no settings write at boot)
}

function initGL() {
  if (!gl) { useVideoFallback(); return; }
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('Shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, vsSource);
  const fs = compile(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) { useVideoFallback(); return; }

  glProgram = gl.createProgram();
  gl.attachShader(glProgram, vs);
  gl.attachShader(glProgram, fs);
  gl.linkProgram(glProgram);
  if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) { useVideoFallback(); return; }
  gl.useProgram(glProgram);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(glProgram, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  sharpLoc = gl.getUniformLocation(glProgram, 'u_sharpness');
  texelLoc = gl.getUniformLocation(glProgram, 'u_texel');
  glReady = true;
  glDirty = true;
}

// Uploading a texture on every display refresh wastes CPU/battery (60 Hz screen, 24 fps video),
// so draw only when the decoder presented a new frame (requestVideoFrameCallback), falling back
// to drawing every refresh when that API is missing or stops firing.
const hasRVFC = typeof video.requestVideoFrameCallback === 'function';
let rvfcHandle = null;
let newFrameAvailable = true;
let lastRvfcAt = 0;

function armFrameWatch() {
  if (!hasRVFC || rvfcHandle !== null) return;
  rvfcHandle = video.requestVideoFrameCallback(() => {
    rvfcHandle = null;
    newFrameAvailable = true;
    lastRvfcAt = performance.now();
    armFrameWatch();
  });
}
function resetFrameWatch() {
  if (!hasRVFC) return;
  if (rvfcHandle !== null) { try { video.cancelVideoFrameCallback(rvfcHandle); } catch (e) {} }
  rvfcHandle = null;
  newFrameAvailable = true;
  armFrameWatch();
}
video.addEventListener('loadstart', resetFrameWatch);

// With sharpening off the picture goes straight from the decoder to the screen (no per-frame texture upload),
// which is what lets 60 fps play without lag; the WebGL canvas is only used while sharpening is on.
function applyDisplayMode() {
  const direct = currentSharpness <= 0 || !!window.AstraNative, f = displayEl.style.filter;
  if (direct) { video.classList.add('gl-viewport', 'aspect-contain'); video.style.display = 'block'; glCanvas.style.display = 'none'; displayEl = video; }
  else { video.style.display = 'none'; glCanvas.style.display = 'block'; displayEl = glCanvas; glDirty = true; }
  displayEl.style.filter = f;
}

function renderGLFrame() {
  if (glReady && !glFallback && (currentSharpness <= 0 || !!window.AstraNative) !== (displayEl === video)) applyDisplayMode();
  if (displayEl === video) { requestAnimationFrame(renderGLFrame); return; }
  armFrameWatch();
  if (glReady && !document.hidden && video.readyState >= 2 && video.videoWidth > 0) {
    let draw = glDirty;
    if (!draw && !video.paused && !video.ended) {
      const stale = performance.now() - lastRvfcAt > 1000;
      draw = !hasRVFC || newFrameAvailable || stale;
    }
    if (draw) {
      if (glCanvas.width !== video.videoWidth || glCanvas.height !== video.videoHeight) {
        glCanvas.width = video.videoWidth;
        glCanvas.height = video.videoHeight;
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.uniform1f(sharpLoc, currentSharpness);
      gl.uniform2f(texelLoc, 1 / glCanvas.width, 1 / glCanvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      glDirty = false;
      newFrameAvailable = false;
    }
  }
  requestAnimationFrame(renderGLFrame);
}

glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glReady = false; });
glCanvas.addEventListener('webglcontextrestored', () => { initGL(); });
['seeked', 'loadeddata', 'canplay', 'emptied'].forEach((evt) => {
  video.addEventListener(evt, () => { glDirty = true; });
});

initGL();
requestAnimationFrame(renderGLFrame);

/* ------------------------------------------------------------------ */
/* Display filters                                                     */
/* ------------------------------------------------------------------ */
function applyCombinedFilters() {
  const b = $('rngBright').value;
  const c = $('rngContrast').value;
  const s = $('rngSat').value;
  const h = $('rngHue').value;
  const w = $('rngWarm').value;

  $('lblBright').textContent = `${b}%`;
  $('lblContrast').textContent = `${c}%`;
  $('lblSat').textContent = `${s}%`;
  $('lblHue').textContent = `${h}°`;
  $('lblWarm').textContent = `${w}%`;

  displayEl.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg) sepia(${w}%)`;
  if (window.astraNativeFilters) window.astraNativeFilters(b, c, s, h, w);
  glDirty = true; // sharpness may have changed while paused
  try { syncRanges(); } catch (e) {}   // repaint the slider fills when a preset set the values from code
  try { syncFilterDropdowns(); } catch (e) {}
  saveCurrentSettings();
}

['rngBright', 'rngContrast', 'rngSat', 'rngHue', 'rngWarm'].forEach((id) => {
  $(id).addEventListener('input', applyCombinedFilters);
});

$('sharpStrength').addEventListener('input', (e) => {
  currentSharpness = parseFloat(e.target.value) / 100;
  $('lblSharp').textContent = currentSharpness > 0 ? `${e.target.value}%` : 'Off';
  glDirty = true;
  try { syncFilterDropdowns(); } catch (err) {}
  saveCurrentSettings();
});

function setActiveFilterChip() { try { syncFilterDropdowns(); } catch (e) {} }

$('btnResetFilters').addEventListener('click', () => {
  $('rngBright').value = 100;
  $('rngContrast').value = 100;
  $('rngSat').value = 100;
  $('rngHue').value = 0;
  $('rngWarm').value = 0;
  $('sharpStrength').value = 0;
  currentSharpness = 0;
  $('lblSharp').textContent = 'Off';
  setActiveFilterChip('normal');
  applyCombinedFilters();
});

/* Filters: preset dropdown, custom dropdown, add-by-name ---------------- */
const FILTER_PRESETS = [
  { k: 'normal',   name: 'Normal',          v: { b: 100, c: 100, s: 100, h: 0, w: 0,  sh: 0 } },
  { k: 'vivid',    name: 'Anime Vivid',     v: { b: 108, c: 120, s: 145, h: 0, w: 0,  sh: 80 } },
  { k: 'cyberpunk',name: 'Cyberpunk',       v: { b: 105, c: 135, s: 160, h: 15, w: 0, sh: 120 } },
  { k: 'sunset',   name: 'Warm Sunset',     v: { b: 102, c: 110, s: 125, h: 0, w: 35, sh: 40 } },
  { k: 'oled',     name: 'OLED Deep',       v: { b: 92,  c: 145, s: 110, h: 0, w: 0,  sh: 60 } },
  { k: 'eyecare',  name: 'Night Eye-Care',  v: { b: 85,  c: 95,  s: 85,  h: 0, w: 50, sh: 0 } },
  { k: 'manga',    name: 'Manga B&W',       v: { b: 110, c: 140, s: 0,   h: 0, w: 0,  sh: 100 } },
  { k: 'sharphd',  name: 'Sharp HD (for 360p)', v: { b: 100, c: 110, s: 105, h: 0, w: 0, sh: 170 } },
  { k: 'daylight', name: 'Bright Daylight', v: { b: 115, c: 105, s: 112, h: 0, w: 0,  sh: 40 } },
  { k: 'darkanime',name: 'Dark Anime',      v: { b: 90,  c: 130, s: 125, h: 0, w: 0,  sh: 70 } },
  { k: 'cinema',   name: 'Cinema',          v: { b: 98,  c: 125, s: 90,  h: 0, w: 12, sh: 40 } },
  { k: 'vintage',  name: 'Vintage Film',    v: { b: 100, c: 105, s: 75,  h: 0, w: 40, sh: 20 } },
  { k: 'retro',    name: 'Retro Warm',      v: { b: 105, c: 95,  s: 130, h: 0, w: 45, sh: 0 } },
  { k: 'sepia',    name: 'Sepia',           v: { b: 100, c: 100, s: 60,  h: 0, w: 100,sh: 0 } },
  { k: 'noir',     name: 'Noir',            v: { b: 95,  c: 150, s: 0,   h: 0, w: 0,  sh: 50 } },
  { k: 'pastel',   name: 'Soft Pastel',     v: { b: 112, c: 88,  s: 115, h: 0, w: 8,  sh: 0 } },
  { k: 'highcon',  name: 'High Contrast',   v: { b: 100, c: 160, s: 110, h: 0, w: 0,  sh: 60 } },
  { k: 'neon',     name: 'Neon Pop',        v: { b: 100, c: 140, s: 200, h: 0, w: 0,  sh: 90 } },
  { k: 'cool',     name: 'Cool Tone',       v: { b: 102, c: 108, s: 108, h: 350, w: 0, sh: 30 } }
];

const FILTERS_KEY = 'astra_saved_filters';
function loadSavedFilters() { try { const v = JSON.parse(localStorage.getItem(FILTERS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
let SAVED_FILTERS = loadSavedFilters();
function storeSavedFilters(list) { SAVED_FILTERS = list; try { localStorage.setItem(FILTERS_KEY, JSON.stringify(list)); } catch (e) {} }
function currentFilterValues() {
  return { b: +$('rngBright').value, c: +$('rngContrast').value, s: +$('rngSat').value, h: +$('rngHue').value, w: +$('rngWarm').value, sh: +$('sharpStrength').value };
}
function applyFilterValues(v) {
  $('rngBright').value = v.b; $('rngContrast').value = v.c; $('rngSat').value = v.s; $('rngHue').value = v.h; $('rngWarm').value = v.w;
  $('sharpStrength').value = v.sh; currentSharpness = v.sh / 100; $('lblSharp').textContent = v.sh > 0 ? `${v.sh}%` : 'Off';
  applyCombinedFilters();
}
function filterSame(a, v) { return a.b === v.b && a.c === v.c && a.s === v.s && a.h === v.h && a.w === v.w && a.sh === v.sh; }
function currentFilterKey() {
  const v = currentFilterValues();
  const pi = FILTER_PRESETS.findIndex((p) => filterSame(p.v, v));
  if (pi >= 0) return 'f:' + FILTER_PRESETS[pi].k;
  const ci = SAVED_FILTERS.findIndex((f) => filterSame(f, v));
  return ci >= 0 ? 'm:' + ci : '';
}
function syncFilterDropdowns() {
  const sp = $('selPreset'), sc = $('selCustom');
  if (!sp || !sc) return;
  const v = currentFilterValues();
  const pi = FILTER_PRESETS.findIndex((p) => filterSame(p.v, v));
  sp.value = pi >= 0 ? FILTER_PRESETS[pi].k : '';
  const ci = SAVED_FILTERS.findIndex((f) => filterSame(f, v));
  sc.value = ci >= 0 ? String(ci) : '';
  const del = $('btnDelFilter'); if (del) del.style.display = sc.value === '' ? 'none' : '';
}

function buildFilterSelects() {
  const sp = $('selPreset'); if (!sp) return;
  sp.textContent = '';
  const adj = new Option('Custom (adjusted)', ''); adj.hidden = true; sp.add(adj);
  FILTER_PRESETS.forEach((p) => sp.add(new Option(p.name, p.k)));
  sp.addEventListener('change', () => {
    const p = FILTER_PRESETS.find((x) => x.k === sp.value);
    if (p) { applyFilterValues(p.v); showToast(`Preset: ${p.name}`, 1100); }
  });
  const sc = $('selCustom');
  sc.addEventListener('change', () => {
    const f = SAVED_FILTERS[+sc.value];
    if (f) { applyFilterValues(f); showToast(`Filter: ${f.name}`, 1100); }
  });
  $('btnDelFilter').onclick = () => {
    const i = +sc.value; if (!(i >= 0) || sc.value === '') return;
    const nm = SAVED_FILTERS[i] && SAVED_FILTERS[i].name;
    const l = SAVED_FILTERS.slice(); l.splice(i, 1); storeSavedFilters(l); renderSavedFilters();
    showToast(`Deleted \u201c${nm}\u201d`, 1200);
  };
  renderSavedFilters();
}
function renderSavedFilters() {
  const sc = $('selCustom'); if (!sc) return;
  sc.textContent = '';
  const ph = new Option(SAVED_FILTERS.length ? 'Choose a custom filter' : 'None yet \u2013 add one below', '');
  if (SAVED_FILTERS.length) ph.hidden = true; else ph.disabled = true;
  sc.add(ph);
  SAVED_FILTERS.forEach((f, i) => sc.add(new Option(f.name, String(i))));
  syncFilterDropdowns();
}
function autoFilterName() {
  const have = new Set(SAVED_FILTERS.map((f) => f.name.toLowerCase()));
  let n = 1; while (have.has(('Filter ' + n).toLowerCase())) n++;
  return 'Filter ' + n;
}
$('btnSaveFilter').onclick = () => {
  const inp = $('filterName'); let name = inp.value.trim().slice(0, 24);
  if (!name) name = autoFilterName();
  const list = SAVED_FILTERS.filter((f) => f.name.toLowerCase() !== name.toLowerCase());
  list.push({ name, ...currentFilterValues() });
  storeSavedFilters(list.slice(-20)); inp.value = ''; renderSavedFilters();
  showToast(`Added filter “${name}”`, 1500);
};
$('filterName').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('btnSaveFilter').click(); });
$('filterName').addEventListener('keyup', (e) => e.stopPropagation());
buildFilterSelects();

/* ------------------------------------------------------------------ */
/* Touch gestures                                                      */
/* ------------------------------------------------------------------ */
const tapTracker = { left: 0, center: 0, right: 0 };
function triggerRipple(id) {
  const el = $(id);
  if (!el) return;
  if (id === 'rippleLeft') el.textContent = `-${prefs.seekStep}s`;
  if (id === 'rippleRight') el.textContent = `+${prefs.seekStep}s`;
  el.classList.remove('trigger');
  void el.offsetWidth;
  el.classList.add('trigger');
  setTimeout(() => el.classList.remove('trigger'), 300);
}

let togglePlayPause = function () {
  if (video.paused) {
    initWebAudio();
    notifyStreamResume();
    video.play().catch(() => {});
  } else {
    video.pause();
    notifyStreamPause();
  }
};

function handleDoubleTap(side) {
  if (isScreenLocked) {
    resetHideTimer();
    return;
  }
  const now = Date.now();
  if (now - tapTracker[side] < 280) {
    tapTracker[side] = 0;
    const curTime = absoluteTime();
    const dur = getDuration() || 9999;

    if (side === 'left') {
      seekToTargetSecond(Math.max(0, curTime - prefs.seekStep));
      triggerRipple('rippleLeft');
    } else if (side === 'right') {
      seekToTargetSecond(Math.min(dur - 2, curTime + prefs.seekStep));
      triggerRipple('rippleRight');
    } else if (side === 'center') {
      togglePlayPause();
      triggerRipple('rippleCenter');
    }
    resetHideTimer();
    return;
  }

  tapTracker[side] = now;
  setTimeout(() => {
    if (tapTracker[side] === now && Date.now() - now >= 230) {
      tapTracker[side] = 0;
      const isHidden = topOverlay.classList.contains('hidden');
      if (isHidden) {
        resetHideTimer();
      } else {
        clearTimeout(hideTimer);
        topOverlay.classList.add('hidden');
        bottomOverlay.classList.add('hidden');
        playerWrapper.classList.add('hud-hidden');
      }
    }
  }, 240);
}

/* Hold the picture: plays at 2x while the finger is down (like MX Player), with a badge at the top */
let holdSuppressClick = false;
(function initHold2x() {
  const badge = document.createElement('div'); badge.className = 'hold-speed'; badge.id = 'holdSpeedBadge';
  badge.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 5l8 7-8 7zM12 5l8 7-8 7z"/></svg><span>2x Speed</span>';
  playerWrapper.appendChild(badge);
  let timer = 0, held = false, sx = 0, sy = 0;
  const stop = () => {
    clearTimeout(timer);
    if (held) { held = false; badge.classList.remove('show'); try { video.playbackRate = playbackSpeed; } catch (e) {} holdSuppressClick = true; setTimeout(() => { holdSuppressClick = false; }, 350); }
  };
  ['touchLeft', 'touchCenter', 'touchRight'].forEach((id) => {
    const z = $(id);
    z.addEventListener('pointerdown', (e) => {
      if (isScreenLocked || e.pointerType === 'mouse' && e.button !== 0) return;
      sx = e.clientX; sy = e.clientY; clearTimeout(timer);
      timer = setTimeout(() => {
        if (video.paused || isScreenLocked) return;
        held = true; try { video.playbackRate = 2; } catch (er) {}
        badge.classList.add('show'); try { if (navigator.vibrate) navigator.vibrate(12); } catch (er) {}
      }, 450);
    });
    z.addEventListener('pointermove', (e) => { if (!held && Math.hypot(e.clientX - sx, e.clientY - sy) > 14) clearTimeout(timer); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => z.addEventListener(ev, stop));
    z.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  video.addEventListener('pause', () => { if (held) stop(); });
})();
$('touchLeft').onclick = (e) => { e.stopPropagation(); if (holdSuppressClick) return; handleDoubleTap('left'); };
$('touchCenter').onclick = (e) => { e.stopPropagation(); if (holdSuppressClick) return; handleDoubleTap('center'); };
$('touchRight').onclick = (e) => { e.stopPropagation(); if (holdSuppressClick) return; handleDoubleTap('right'); };

/* ------------------------------------------------------------------ */
/* Seeking / stream switching                                          */
/* ------------------------------------------------------------------ */
function transcodeUrl(sec) {
  return `/stream/transcode?file=${encodeURIComponent(activeVideoPath)}`
    + `&audioTrack=${encodeURIComponent(activeAudioStreamIndex)}`
    + `&startTime=${sec}&is10Bit=${isCurrentFile10Bit ? '1' : '0'}&q=${effectiveQuality()}${prefs.hwEnc === 'auto' ? '&enc=hw' : ''}&sid=${TC_SID}`;
}


/* Top-left title: BIG TITLE + blue " • S01E02", then "length  size  TYPE". */
function setTopTitle(title, tag) {
  playerCurrentTitle.textContent = '';
  playerCurrentTitle.appendChild(document.createTextNode(title || ''));
  if (tag) { const e = document.createElement('span'); e.className = 'tt-ep'; e.textContent = ' \u2022 ' + tag; playerCurrentTitle.appendChild(e); }
  updateTopMeta();
}
function updateTopMeta() {
  const el = $('topMetaLine'); if (!el) return;
  const dur = (typeof getDuration === 'function' && getDuration()) || currentExplicitDuration || 0;
  const bytes = currentFileBytes || 0;
  const size = bytes >= 1073741824 ? (bytes / 1073741824).toFixed(2) + ' GB' : bytes >= 1048576 ? Math.round(bytes / 1048576) + ' MB' : bytes > 0 ? Math.round(bytes / 1024) + ' KB' : '';
  const ext = ((activeVideoPath || '').split('.').pop() || '').toUpperCase();
  el.textContent = [dur > 0 ? formatTime(dur) : '', size, ext && ext.length <= 5 ? ext : ''].filter(Boolean).join('  \u00b7  ');
}
function syncTopHudBadges() {
  updateTopMeta();
  const h = video.videoHeight;
  const qStr = h > 0 ? (h + "p") : (playerResBadge.textContent || "Auto");
  const fpsVal = (typeof currentVideoFps !== "undefined" && currentVideoFps > 0) ? currentVideoFps : 0;
  const fpsStr = fpsVal > 0 ? ("@" + fpsVal + "fps") : "";
  const bitStr = sourceIs10Bit ? "10 Bit" : "8 Bit";

  const rfPill = $("topResFpsPill");
  if (rfPill) rfPill.textContent = qStr + fpsStr;

  const bitPill = $("topBitPill");
  if (bitPill) {
    bitPill.textContent = bitStr;
    bitPill.classList.toggle("bit-10", !!sourceIs10Bit);
    bitPill.classList.toggle("bit-ok", !sourceIs10Bit);
  }

  const qv = $("qualityValue");
  const fpsInline = $("topFpsInline");
  if (qv) qv.textContent = qStr;
  if (fpsInline) fpsInline.textContent = fpsVal > 0 ? (fpsVal + "fps") : "";
}

function formatDataRate(bytesPerSec) {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "0.0 Mbps";
  const mbps = (bytesPerSec * 8) / 1000000;
  if (mbps >= 100) return Math.round(mbps) + " Mbps";
  if (mbps >= 1) return mbps.toFixed(1) + " Mbps";
  return Math.max(1, Math.round((bytesPerSec * 8) / 1000)) + " Kbps";
}

setInterval(() => {
  if (currentView !== "player" || document.hidden || !activeVideoPath) return;
  syncTopHudBadges();
}, 1500);

function updateQualityReadout() {
  syncTopHudBadges();
  const qv = $('qualityValue'), qt = $('qualityType');
  if (!qv || !qt) return;
  const h = video.videoHeight;
  qv.textContent = h > 0 ? `${h}p` : (playerResBadge.textContent || 'Auto');
  const ten = !!sourceIs10Bit;
  let label;
  if (isTranscodingMode) label = ten ? '10-bit \u00b7 Decoding' : (compatMode ? '8-bit \u00b7 Compat' : '8-bit \u00b7 Transcode');
  else label = ten ? '10-bit \u00b7 Native' : '8-bit \u00b7 Direct';
  qt.textContent = label;
  qt.className = `q-type ${ten ? 'hi' : 'ok'}`;
}
function updateStreamBadges() {
  setTimeout(updateQualityReadout, 0);
  if (isTranscodingMode) {
    streamModeBadge.textContent = compatMode ? 'Compat Transcode' : (isCurrentFile10Bit ? '10-Bit Transcode' : 'Direct Audio Pipe');
    if (sourceModePill) sourceModePill.textContent = 'Transcode Stream';
  } else {
    streamModeBadge.textContent = 'Native Direct (8-Bit)';
    if (sourceModePill) sourceModePill.textContent = 'Native Stream';
  }
}


function armStartWatch() {
  clearInterval(startWatch);
  const t0 = Date.now();
  const token = playToken;
  startWatch = setInterval(() => {
    if (token !== playToken || !isTranscodingMode || video.readyState >= 1) { clearInterval(startWatch); return; }
    const s = Math.floor((Date.now() - t0) / 1000);
    probeLoadingText.textContent = `Preparing video… ${s}s (10-bit videos can take a while on slow phones)`;
    if (s === 40 && prefs.quality === 'auto' && !qualityOverride && autoLevel < AUTO_LEVELS.length - 1) {
      clearInterval(startWatch);
      autoLevel++; autoLastStep = Date.now();
      showToast('Taking too long to start \u2192 trying a lower quality', 3000);
      seekToTargetSecond(absoluteTime(), true, true);   // auto-step-restart
      return;
    }
    if (s === 75) {
      clearInterval(startWatch);
      showToast('The video did not start after 75 seconds.', 4000, 'err');
    }
  }, 1000);
}

async function startTranscodeAt(sec, label = 'Starting stream...') {
  const token = ++playToken;          // a newer request cancels this one
  sec = Math.max(0, sec);
  probeLoadingText.textContent = label;
  playerBufferingIndicator.classList.add('show');

  // Video is copied (not re-encoded) for 8-bit files, so it can only start on a keyframe.
  // Snap to it so audio and video start together and the clock/subtitles stay exact.
  if (!isCurrentFile10Bit && sec > 0) {
    try {
      const res = await fetch(`/api/video/keyframe?file=${encodeURIComponent(activeVideoPath)}&t=${sec}`);
      const data = await res.json();
      if (Number.isFinite(data.time) && data.time <= sec) sec = data.time;
    } catch (e) { /* fall back to the requested time */ }
    if (token !== playToken) return;
  }


  // 10-bit streams: a finished conversion may already be saved on the server. If so, start from its keyframe
  // (nothing is re-encoded) so the clock and subtitles stay exact.
  if (isCurrentFile10Bit) {
    try {
      const cres = await fetch(`/api/transcode/cache-start?file=${encodeURIComponent(activeVideoPath)}&audioTrack=${encodeURIComponent(activeAudioStreamIndex)}&q=${effectiveQuality()}&t=${sec}`);
      const cd = await cres.json();
      if (cd.hit && Number.isFinite(cd.time) && cd.time <= sec + 0.05) sec = cd.time;
    } catch (e) { /* no cache info: start normally */ }
    if (token !== playToken) return;
  }

  isTranscodingMode = true;
  transcodeBaseOffset = sec;
  updateStreamBadges();
  video.src = transcodeUrl(sec);
  video.load();
  armStartWatch();
  video.play().catch(() => {});
}

function seekToTargetSecond(targetSec, skipUndo = false, forceRestart = false) {
  if (!skipUndo && Math.abs(targetSec - absoluteTime()) > 2) recordSeekOrigin(absoluteTime());
  const dur = getDuration() || 1;
  const clampedSec = Math.max(0, Math.min(dur - 1, targetSec));

  if (!isTranscodingMode) {
    video.currentTime = clampedSec;
    savePlaybackState();
    setupSubtitleCues();
    return;
  }

  // Target already buffered (and seekable)? Just move the playhead: no new ffmpeg, no probe, no wait.  // buffered-seek
  if (!forceRestart && video.readyState >= 1) {
    const rel = clampedSec - transcodeBaseOffset;
    const covers = (r) => { for (let i = 0; i < r.length; i++) if (r.start(i) <= rel + 0.05 && r.end(i) - rel > 1.5) return true; return false; };
    if (rel >= 0 && covers(video.buffered) && covers(video.seekable)) {
      const tok = playToken;
      video.currentTime = rel;
      setTimeout(() => { if (tok === playToken && isTranscodingMode && video.seeking) startTranscodeAt(clampedSec, 'Seeking stream...'); }, 4000);   // safety net
      savePlaybackState();
      setupSubtitleCues();
      return;
    }
  }

  // Transcoded streams restart at the requested absolute time (avoids the 0:00 jump bug).
  startTranscodeAt(clampedSec, 'Seeking stream...');
  savePlaybackState();
  setupSubtitleCues();
}

/* ------------------------------------------------------------------ */
/* Loading & playing an episode                                        */
/* ------------------------------------------------------------------ */
function isActiveItem(v) {
  return v.relPath === activeVideoPath || v.fullPath === activeVideoPath;
}

function findFolderForPath(p, rawName) {
  const folders = Object.keys(fullLibrary);
  // Exact path match first; file name is only a last-resort fallback (names repeat across series).
  const byPath = folders.find((f) => fullLibrary[f].some((v) => v.relPath === p || v.fullPath === p));
  if (byPath !== undefined) return byPath;
  if (rawName) {
    const byName = folders.find((f) => fullLibrary[f].some((v) => v.name === rawName));
    if (byName !== undefined) return byName;
  }
  return null;
}

function resetTimelineUI() {
  isScrubbing = false;
  timelineSlider.value = 0;
  trackPlayed.style.width = '0%';
  trackBuffer.style.width = '0%';
  timeLabel.textContent = '00:00 / 00:00';
  playerDurationBadge.textContent = '--:--';
}

function updateMediaSession() {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: playerCurrentTitle.textContent,
      artist: currentPathTokens.join(' / ') || 'Astra Player',
      album: 'Astra Player'
    });
  } catch (e) {}
}

function setupMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return;
  const set = (action, fn) => { try { navigator.mediaSession.setActionHandler(action, fn); } catch (e) {} };
  set('play', () => { initWebAudio(); notifyStreamResume(); video.play().catch(() => {}); });
  set('pause', () => { video.pause(); });
  set('previoustrack', () => playAdjacentEpisode(-1));
  set('nexttrack', () => playAdjacentEpisode(1));
  set('seekbackward', () => seekToTargetSecond(Math.max(0, absoluteTime() - prefs.seekStep)));
  set('seekforward', () => seekToTargetSecond(absoluteTime() + prefs.seekStep));
}
setupMediaSessionHandlers();

function playAdjacentEpisode(step, auto = false) {
  const idx = currentVideoList.findIndex(isActiveItem);
  const next = idx === -1 ? null : currentVideoList[idx + step];
  if (!next) {
    if (!auto) showToast(step > 0 ? 'This is the last episode' : 'This is the first episode');
    return;
  }
  inspectMediaAndPlay(next.name, next.relPath || next.fullPath, 0);
}

// While an episode plays, quietly ready the next one: ffprobe result cached on the server and its first MB read into the OS cache.
let warmedNext = '';
function warmNextEpisode() {
  try {
    const idx = currentVideoList.findIndex(isActiveItem);
    const nx = idx === -1 ? null : currentVideoList[idx + 1];
    const rel = nx && (nx.relPath || nx.fullPath);
    if (!rel || rel === warmedNext) return;
    warmedNext = rel;
    fetch(`/api/video/metadata?file=${encodeURIComponent(rel)}`).catch(() => {});
    fetch(`/stream?file=${encodeURIComponent(rel)}`, { headers: { Range: 'bytes=0-1048575' } }).then((r) => r.arrayBuffer()).catch(() => {});
  } catch (e) {}
}

var lastOpen = { title: '', rel: '' };
async function inspectMediaAndPlay(rawTitle, relPath, seekTime = 0) {
  lastOpen = { title: rawTitle, rel: relPath }; videoUnloaded = false;
  autoLevel = 0; autoSlowHits = 0;
  const token = ++playToken;
  seekTime = Number(seekTime) > 0 ? Number(seekTime) : 0;

  // Fresh state for the new file (nothing may leak over from the previous episode).
  activeVideoPath = relPath;
  updatePlayerEmptyState();
  setChapters([]);
  nativeFallbackTried = false;
  compatMode = false;
  isCurrentFile10Bit = false;
  sourceIs10Bit = false;
  frameStuck = 0;
  isTranscodingMode = false;
  currentExplicitDuration = 0;
  activeAudioStreamIndex = '0:a:0';
  transcodeBaseOffset = 0;
  lastRecordedTime = 0;
  manualCenterPlay.style.display = 'none';
  resetSubtitleState();
  resetTimelineUI();
  setSubDelay(0);

  const hdr = formatCardHeader(rawTitle);
  setTopTitle(hdr.title, hdr.tag);
  updateActiveEpisodeDescription();

  if (!currentVideoList.some(isActiveItem)) {
    const folder = findFolderForPath(relPath, rawTitle);
    if (folder !== null) {
      currentPathTokens = folder === 'Anime Root' ? [] : folder.split(' / ');
      currentVideoList = fullLibrary[folder];
    }
  }

  const rootBase = (libraryRoot || '').split('/').filter(Boolean).pop() || 'Storage';
  const subPath = currentPathTokens.join(' / ');
  const folderLabel = subPath ? (rootBase + ' / ' + subPath) : rootBase;
  playerCurrentFolder.textContent = folderLabel;
  if (epDrawerFolderName) epDrawerFolderName.textContent = folderLabel;
  renderFloatingEpisodes();
  renderInlinePlaylist();
  updateMediaSession();
  syncDeepLink(relPath);
  syncOnlineArtworkForActive();

  probeLoadingText.textContent = 'Scanning audio & subtitles...';
  playerBufferingIndicator.classList.add('show');

  let meta = null;
  try {
    const res = await fetch(`/api/video/metadata?file=${encodeURIComponent(relPath)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    meta = await res.json();
  } catch (e) {
    meta = null;
  }
  if (token !== playToken) return; // another episode was requested meanwhile

  let useTranscode = false;
  if (meta) {
    currentExplicitDuration = Number(meta.duration) || 0;
    currentVideoFps = Number(meta.videoFps) || 0;
    currentFileBytes = Number(meta.size) || 0;
    playerDurationBadge.textContent = formatTime(currentExplicitDuration);
    updateTopMeta();
    isCurrentFile10Bit = !!meta.is10BitHevc;
    sourceIs10Bit = isCurrentFile10Bit;
    // sticky mode: if this episode once needed the transcoder, it starts there every time (no flipping back to direct)
    if (!isCurrentFile10Bit && vpGet(relPath).tc) { compatMode = true; isCurrentFile10Bit = true; }
    setChapters(meta.chapters || []);

    audioTrackList.innerHTML = '';
    let selectedTrackIndex = 0;
    const audioTracks = meta.audioTracks || [];

    if (preferredDefaultLang !== 'auto' && audioTracks.length > 0) {
      const matchIdx = audioTracks.findIndex((t) => (t.lang || '').includes(preferredDefaultLang) || (t.title || '').toLowerCase().includes(preferredDefaultLang));
      if (matchIdx !== -1) selectedTrackIndex = matchIdx;
    }

    audioTracks.forEach((t, idx) => {
      const isSelected = (idx === selectedTrackIndex);
      const row = document.createElement('div');
      row.className = `opt-row ${isSelected ? 'selected' : ''}`;
      row.textContent = `${t.title} (${String(t.codec || 'aac').toUpperCase()})`;
      row.onclick = () => {
        if (t.streamIndex === activeAudioStreamIndex) return; // already playing this track
        selectOptRow(audioTrackList, row);
        activeAudioStreamIndex = t.streamIndex;
        if (window.astraNativeAudio) { window.astraNativeAudio(idx); showToast('Audio: ' + t.title, 1500, 'info'); return; }   // app: switch inside the player, no conversion
        startTranscodeAt(absoluteTime());
      };
      audioTrackList.appendChild(row);
      if (isSelected) activeAudioStreamIndex = t.streamIndex;
    });

    buildSubtitleList(meta.subtitleTracks || [], relPath);

    useTranscode = !window.AstraNative && (isCurrentFile10Bit || selectedTrackIndex > 0);
  } else {
    audioTrackList.innerHTML = '<div class="opt-row selected">Default Track</div>';
    buildSubtitleList([], relPath);
  }

  if (useTranscode) {
    isTranscodingMode = true;
    transcodeBaseOffset = seekTime;
    updateStreamBadges();
    probeLoadingText.textContent = 'Starting transcoder…';
    video.src = transcodeUrl(seekTime);
    armStartWatch();
  } else {
    isTranscodingMode = false;
    updateStreamBadges();
    video.src = `/stream?file=${encodeURIComponent(relPath)}`;
  }

  savePlaybackState();
  finalizePlayback(seekTime);
}

function finalizePlayback(seekTime) {
  initWebAudio();
  setupSubtitleCues();
  loadSavedSettings();
  initWebAudio();   // only if a saved EQ / audio delay needs it

  video.onloadedmetadata = () => {
    video.playbackRate = playbackSpeed;
    playerBufferingIndicator.classList.remove('show');
    const dur = getDuration();
    if (!isTranscodingMode && seekTime > 0 && seekTime < dur - 5) {
      video.currentTime = seekTime;
    }
    playerDurationBadge.textContent = formatTime(dur);
    updateTopMeta();
    const h = video.videoHeight;
    playerResBadge.textContent = h >= 1080 ? '1080p' : h >= 720 ? '720p' : h > 0 ? `${h}p` : 'Auto';
    updateQualityReadout();
    setTimeout(warmNextEpisode, 15000);
    if (isTranscodingMode && needBuf() > 0 && !internalPause) { video.pause(); startRebuffer(); }
    else if (prefs.autoPlay === false || forcePauseOnce) { forcePauseOnce = false; video.pause(); manualCenterPlay.style.display = 'flex'; updatePlayButtonIcon(false); }
    else video.play().catch(() => { manualCenterPlay.style.display = 'flex'; });
    resetHideTimer();
  };
}

/* ------------------------------------------------------------------ */
/* <video> events                                                      */
/* ------------------------------------------------------------------ */
video.addEventListener('canplay', () => { playerBufferingIndicator.classList.remove('show'); });
video.addEventListener('waiting', () => {
  if (isTranscodingMode && !video.paused && !internalPause && needBuf() > 0 && !isScrubbing) { startRebuffer(); return; }
  if (!video.paused) {
    probeLoadingText.textContent = 'Buffering...';
    playerBufferingIndicator.classList.add('show');
  }
});
video.addEventListener('play', () => {
  manualCenterPlay.style.display = 'none';
  resumeAudio();
  notifyStreamResume(); // wakes a paused (frozen) transcoder no matter how playback started
});
video.addEventListener('playing', () => {
  armPictureWatch();
  playerBufferingIndicator.classList.remove('show');
  manualCenterPlay.style.display = 'none';
  updatePlayButtonIcon(true);
});
video.addEventListener('pause', () => {
  if (internalPause) return;
  // paused by the user: big play button in the middle of the picture
  setTimeout(() => { if (video.paused && !video.ended && !isScreenLocked && activeVideoPath) manualCenterPlay.style.display = 'flex'; }, 120);
  updatePlayButtonIcon(false);
  notifyStreamPause();
});

video.addEventListener('ended', () => {
  const dur = getDuration();
  const nearEnd = !dur || absoluteTime() >= dur - 20;
  if (!nearEnd) {
    // A transcoded stream that dies early also fires "ended" - don't skip the episode.
    showToast('Stream ended early. Seek or press play to continue.', 4000);
    return;
  }
  if (activeVideoPath && dur) {
    syncHistoryToServer(activeVideoPath, playerCurrentTitle.textContent, dur, dur);
  }
  if (sleepAtEnd) { sleepAtEnd = false; setSleep(0); showToast('Sleep timer: stopped', 3000); return; }
  if (prefs.autoNext) playAdjacentEpisode(1, true); // auto-play next episode
});

function fallbackToTranscode(msg) {
  if (window.AstraNative) return false;               // the app decodes natively: no server transcoder to fall back to (frame counters are not available there)
  if (isTranscodingMode || nativeFallbackTried) return false;
  nativeFallbackTried = true;
  compatMode = true;
  isCurrentFile10Bit = true; // forces full video transcode to H.264
  try { vpSet(activeVideoPath, { tc: 1 }); } catch (e) {}      // remember: stay on the transcoder for this episode
  showToast(msg, 4000);
  startTranscodeAt(video.currentTime || 0);
  return true;
}
// Some phones "play" HEVC as sound only (decoder missing): no picture => switch to the transcoder.
let pictureWatch = null;
function armPictureWatch() {
  clearTimeout(pictureWatch);
  if (window.AstraNative || isTranscodingMode || nativeFallbackTried) return;
  const token = playToken;
  pictureWatch = setTimeout(() => {
    if (token !== playToken || isTranscodingMode || video.paused || video.currentTime < 0.5) return;
    let frames = 1;
    try { const q = video.getVideoPlaybackQuality && video.getVideoPlaybackQuality(); if (q) frames = q.totalVideoFrames; } catch (e) {}
    if (video.videoWidth === 0 || frames === 0) fallbackToTranscode('No picture from this video — switching to compatibility transcode');
  }, 3500);
}

/* v1.15 automatic mode switching: a frozen picture (sound keeps going) restarts the stream, or moves direct play to the transcoder.
   Once an episode has needed the transcoder it stays there (sticky, saved per episode). */
let frameStuck = 0, frameLast = -1, timeLast = -1, fixTimes = [];
setInterval(() => {
  try {
    if (window.AstraNative || !activeVideoPath || video.paused || video.seeking || video.ended || document.hidden || internalPause || video.readyState < 3 || !video.getVideoPlaybackQuality) { frameStuck = 0; frameLast = -1; return; }
    const f = video.getVideoPlaybackQuality().totalVideoFrames, t = video.currentTime;
    if (frameLast >= 0 && f === frameLast && t - timeLast > 0.6) frameStuck++; else frameStuck = 0;
    frameLast = f; timeLast = t;
    if (frameStuck < 3) return;
    frameStuck = 0; frameLast = -1;
    if (!isTranscodingMode) { fallbackToTranscode('Picture froze — switching to compatibility mode'); return; }
    const now = Date.now(); fixTimes = fixTimes.filter((x) => now - x < 120000);
    if (fixTimes.length >= 3) return;                                   // do not loop forever
    fixTimes.push(now);
    showToast('Picture froze — restarting the stream', 2500);
    startTranscodeAt(absoluteTime(), 'Fixing frozen picture...');
  } catch (e) {}
}, 1000);
video.addEventListener('error', () => {
  if (!activeVideoPath || !video.getAttribute('src')) return;
  playerBufferingIndicator.classList.remove('show');

  // The browser could not play the file natively (HEVC, odd codecs, ...): retry once through the transcoder.
  if (fallbackToTranscode('Format not supported natively — switching to compatibility transcode')) return;
  showToast('Playback failed. The file may be missing or unsupported.', 4500);
});

function updatePlayButtonIcon(isPlaying) {
  playBtn.classList.toggle('playing', !!isPlaying);   // the two icons morph in CSS
}

function updateBufferLine() {
  const dur = getDuration();
  if (!dur || !video.buffered.length || !trackBuffer) return;

  for (let i = video.buffered.length - 1; i >= 0; i--) {
    if (video.buffered.start(i) <= video.currentTime) {
      const bufferEnd = isTranscodingMode ? (transcodeBaseOffset + video.buffered.end(i)) : video.buffered.end(i);
      const bufferPercent = Math.min(100, (bufferEnd / dur) * 100);
      trackBuffer.style.width = `${bufferPercent}%`;
      break;
    }
  }
}

video.addEventListener('progress', updateBufferLine);

video.addEventListener('timeupdate', () => {
  const dur = getDuration();
  if (!dur) return;

  const currentExactSec = absoluteTime();
  if (!isScrubbing) {
    let shown = currentExactSec;
    if (seekPending) { if (Date.now() > seekPending.until || Math.abs(currentExactSec - seekPending.sec) < 1.5) seekPending = null; else shown = seekPending.sec; }
    seekCtl.paint(shown, dur, false, true);
  }

  updateBufferLine();
  updateSubtitleDisplay();
  onChapterTick(currentExactSec);

  const currentSec = Math.floor(currentExactSec);
  if (currentSec > 0 && Math.abs(currentSec - lastRecordedTime) >= 3 && activeVideoPath) {
    lastRecordedTime = currentSec;
    savePlaybackState();
    syncHistoryToServer(activeVideoPath, playerCurrentTitle.textContent, currentExactSec, dur);
  }
});

// Subtitle timing needs finer resolution than timeupdate's ~4 Hz.
let subTick = 0;
setInterval(() => {
  if (!video.paused && subsOn && (!isLite() || (subTick++ & 1) === 0)) updateSubtitleDisplay();
}, 120);


/* ===== Safe Seekbar (Thumb-Drag Only on Touch + Undo Seek) ===== */
let lastSeekOrigin = null;
let undoSeekTimer = null;
function recordSeekOrigin(prevSec) {
  if (!Number.isFinite(prevSec) || prevSec < 0) return;
  lastSeekOrigin = prevSec;
  const uBtn = $("undoSeekBtn");
  if (uBtn) {
    uBtn.textContent = "↺ Undo " + formatTime(prevSec);
    uBtn.style.display = "inline-flex";
    clearTimeout(undoSeekTimer);
    undoSeekTimer = setTimeout(() => { uBtn.style.display = "none"; }, 6000);
  }
}
const undoBtnEl = $("undoSeekBtn");
if (undoBtnEl) {
  undoBtnEl.onclick = (e) => {
    e.stopPropagation();
    if (lastSeekOrigin != null) {
      const target = lastSeekOrigin;
      lastSeekOrigin = null;
      undoBtnEl.style.display = "none";
      seekToTargetSecond(target, true);
    }
  };
}

/* ===== Seek bar (rebuilt in 2.10.13): one tall touch area, tap or drag. The picture seeks only when you let go. ===== */
let lastSnappedChapterStart = -1;
let seekPending = null;                                         // after letting go, keep showing the target until the player arrives
const seekCtl = (function () {
  const hit = $('seekHit'), wrap = document.querySelector('.custom-track-wrapper'), box = wrap && wrap.closest('.timeline-box');
  if (!hit || !wrap || !box) return { paint() {} };
  const bubble = document.createElement('div'); bubble.className = 'seek-bubble'; wrap.appendChild(bubble);
  let target = 0, pid = null;
  const paint = (sec, dur, snapped, live) => {
    const pct = clamp((sec / dur) * 100, 0, 100);
    timelineSlider.value = pct; trackPlayed.style.width = pct + '%';
    timeLabel.textContent = `${formatTime(sec)} / ${formatTime(dur)}`;
    if (live) return;                                                         // normal playback: only the bar and the time
    bubble.textContent = formatTime(sec);
    bubble.style.left = clamp((pct / 100) * (wrap.clientWidth || 1), 26, Math.max(26, (wrap.clientWidth || 1) - 26)) + 'px';
    const ch = chapterAt(sec);
    if (chapterLabel) { chapterLabel.textContent = ch ? ch.title : ''; chapterLabel.style.display = ch ? 'inline-flex' : 'none'; chapterLabel.classList.toggle('snapped', !!snapped); }
  };
  const move = (e) => {
    const dur = getDuration(); if (!dur) return;
    const r = wrap.getBoundingClientRect();
    let sec = clamp((e.clientX - r.left) / (r.width || 1), 0, 1) * dur, snapped = false;
    if (Array.isArray(chapters) && chapters.length) {                         // magnetic lock onto chapter starts
      const win = dur * 0.015;
      for (let i = 0; i < chapters.length; i++) if (Math.abs(sec - chapters[i].start) <= win) { sec = chapters[i].start; snapped = true; break; }
    }
    if (snapped && lastSnappedChapterStart !== sec) { lastSnappedChapterStart = sec; if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) {} }
    if (!snapped) lastSnappedChapterStart = -1;
    target = sec; paint(sec, dur, snapped);
  };
  const end = (commit) => {
    if (pid === null) return;
    pid = null; isScrubbing = false; box.classList.remove('scrubbing');
    if (chapterLabel) chapterLabel.classList.remove('snapped');
    if (commit && !isScreenLocked && getDuration()) { seekPending = { sec: target, until: Date.now() + 1800 }; seekToTargetSecond(target); }
  };
  hit.addEventListener('pointerdown', (e) => {
    if (isScreenLocked || !getDuration()) return;
    e.preventDefault(); e.stopPropagation();
    pid = e.pointerId; try { hit.setPointerCapture(pid); } catch (_) {}
    isScrubbing = true; seekPending = null; box.classList.add('scrubbing'); move(e);
  });
  hit.addEventListener('pointermove', (e) => { if (pid !== null && e.pointerId === pid) { e.preventDefault(); move(e); } });
  hit.addEventListener('pointerup', (e) => { if (e.pointerId === pid) end(true); });
  hit.addEventListener('pointercancel', () => end(false));
  hit.addEventListener('lostpointercapture', () => end(true));
  return { paint };
})();

/* ------------------------------------------------------------------ */
/* Player controls                                                     */
/* ------------------------------------------------------------------ */
let fakeFs = false;          // CSS rotation active (works with phone auto-rotate OFF)
let switchingFs = false;
function toastHost() {
  if (fakeFs) return playerWrapper;
  const f = document.fullscreenElement;
  return (f && f !== document.documentElement) ? f : document.body;
}
let rotatedLandscape = false;
function setFakeFs(on) {
  fakeFs = on;
  playerWrapper.classList.toggle('fake-fs', on);
  document.body.classList.toggle('fake-fs-on', on);
  const t = $('astraToast');
  if (t) { const host = toastHost(); if (t.parentNode !== host) host.appendChild(t); }
  resetHideTimer();
}
async function enterLandscape() {
  rotatedLandscape = true;
  if (screen.orientation && screen.orientation.lock) {
    try { await screen.orientation.lock('landscape'); } catch (e) { /* refused: fall through to CSS rotation */ }
  }
  await new Promise((r) => setTimeout(r, 250));
  if (window.innerHeight > window.innerWidth) {
    // Still portrait: Chrome forbids transforms on the fullscreen element itself, so make the
    // whole page the fullscreen element and rotate the player inside it.
    switchingFs = true;
    try {
      if (document.fullscreenElement === playerWrapper) await document.exitFullscreen();
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch (e) { /* fullscreen refused: still rotate inside the page */ }
    switchingFs = false;
    setFakeFs(true);
  }
}
function leaveLandscape() {
  rotatedLandscape = false;
  setFakeFs(false);
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
}
async function toggleFullscreen() {
  if (isScreenLocked) return;
  if (!document.fullscreenElement && !fakeFs) {
    await playerWrapper.requestFullscreen().catch(() => {});
    if (prefs.fsRotate) await enterLandscape();
  } else {
    leaveLandscape();
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  }
}
fsBtn.onclick = toggleFullscreen;
// Phone physically rotated (or window resized) while the CSS rotation was on: drop it.
// (ignored while typing: the on-screen keyboard shrinks the window and must not drop us out of fullscreen)
const isTyping = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' && !/^(range|checkbox|color|radio|button)$/.test(a.type) || a.tagName === 'TEXTAREA'); };
let resizeT = null;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (isTyping()) return; if (fakeFs && window.innerWidth > window.innerHeight) { setFakeFs(false); rotatedLandscape = false; } }, 180); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && fakeFs) leaveLandscape(); });

// Also covers leaving fullscreen with the system back gesture.
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && !switchingFs) { rotatedLandscape = false; setFakeFs(false); }
  if (!document.fullscreenElement && screen.orientation && screen.orientation.unlock) {
    try { screen.orientation.unlock(); } catch (e) {}
  }
});

playBtn.onclick = () => {
  if (isScreenLocked) return;
  initWebAudio();
  togglePlayPause();
};

function syncVolIcon() {
  const off = video.muted || video.volume === 0;
  volBtn.classList.toggle('muted', off);
}
function toggleMute() {
  video.muted = !video.muted;
  syncVolIcon();
}
// Remember volume / mute between sessions (debounced)
let volSaveTimer = null;
video.addEventListener('volumechange', () => {
  clearTimeout(volSaveTimer);
  volSaveTimer = setTimeout(saveCurrentSettings, 400);
});

/* ---- Playback speed ---- */
function setPlaybackSpeed(rate, announce = true) {
  playbackSpeed = clamp(Number(rate) || 1, 0.25, 4);
  video.defaultPlaybackRate = playbackSpeed;
  video.playbackRate = playbackSpeed;
  document.querySelectorAll('[data-speed]').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.speed) === playbackSpeed);
  });
  if (announce) { showToast(`Speed ${playbackSpeed}×`, 1200); saveCurrentSettings(); }
}
document.querySelectorAll('[data-speed]').forEach((btn) => {
  btn.onclick = () => setPlaybackSpeed(btn.dataset.speed);
});
const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
function stepSpeed(dir) {
  let i = SPEED_STEPS.findIndex((v) => v >= playbackSpeed - 1e-6);
  if (i === -1) i = SPEED_STEPS.length - 1;
  setPlaybackSpeed(SPEED_STEPS[clamp(i + dir, 0, SPEED_STEPS.length - 1)]);
}

/* ---- Subtitle delay ---- */
const fmtDelay = (d) => `${d > 0 ? '+' : ''}${d.toFixed(2)} s`;
function setSubDelay(sec, announce = false, persist = announce) {
  subDelay = clamp(Math.round((Number(sec) || 0) * 100) / 100, -600, 600);
  if (rngSubDelay) rngSubDelay.value = clamp(subDelay, -10, 10);
  const inp = $('subSyncVal');
  if (inp && document.activeElement !== inp) inp.value = fmtDelay(subDelay);
  if (persist && activeVideoPath) vpSet(activeVideoPath, { delay: subDelay });
  activeSubSignature = '\u0000';
  updateSubtitleDisplay();
  if (announce) showToast(`Subtitle delay ${fmtDelay(subDelay)}`, 1200);
}
// "1.35", "+1,5", "-0.4s", "0:2.5" (minutes:seconds)
function parseDelay(txt) {
  let t = String(txt).trim().toLowerCase().replace(/s$/, '').replace(',', '.').replace(/\s+/g, '');
  if (!t) return null;
  const neg = t.startsWith('-'); t = t.replace(/^[+-]/, '');
  const parts = t.split(':'); let v = 0;
  if (parts.length === 2) v = (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0); else v = parseFloat(t);
  return isFinite(v) ? (neg ? -v : v) : null;
}
(function () {
  const inp = $('subSyncVal'); if (!inp) return;
  inp.addEventListener('focus', () => { inp.value = subDelay.toFixed(2); setTimeout(() => { try { inp.select(); } catch (e) {} }, 0); });
  const commit = () => { const v = parseDelay(inp.value); if (v !== null) setSubDelay(v, true); inp.value = fmtDelay(subDelay); };
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
  const hold = (id, dir) => {
    const b = $(id); if (!b) return; let t1 = null, t2 = null;
    const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); setSubDelay(subDelay + dir * 0.1, false, true); t1 = setTimeout(() => { t2 = setInterval(() => setSubDelay(subDelay + dir * 0.1, false, true), 90); }, 380); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop));
  };
  hold('subSyncMinus', -1); hold('subSyncPlus', 1);
  const rs = $('subSyncReset'); if (rs) rs.onclick = () => setSubDelay(0, true);
})();
if (rngSubDelay) rngSubDelay.addEventListener('input', (e) => setSubDelay(e.target.value, false, true));

volBtn.onclick = () => {
  if (isScreenLocked) return;
  toggleMute();
};

rwBtn.onclick = () => { if (!isScreenLocked) playAdjacentEpisode(-1); };      // bottom row: previous / next episode (double-tap the picture to jump 10 s)
ffBtn.onclick = () => { if (!isScreenLocked) playAdjacentEpisode(1); };
bigPlayBtn.onclick = () => {
  if (isScreenLocked) return;
  manualCenterPlay.style.display = 'none';
  initWebAudio();
  notifyStreamResume();
  video.play().catch(() => {});
};

lockBtn.onclick = (e) => {
  e.stopPropagation();
  isScreenLocked = !isScreenLocked;
  playerWrapper.classList.toggle('is-locked', isScreenLocked);

  lockBtn.classList.toggle("is-locked-btn", isScreenLocked);
  lockBtn.innerHTML = isScreenLocked
    ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span id="lockBtnText">LOCKED</span>'
    : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span id="lockBtnText">LOCK</span>';

  if (isScreenLocked) {
    settingsModal.classList.remove('open');
    playerEpisodesDrawer.classList.remove('open');
    bottomOverlay.classList.add('hidden');
    document.querySelectorAll('.top-title-group, .btn-group, .timeline-box').forEach((el) => { el.style.pointerEvents = 'none'; });
  } else {
    document.querySelectorAll('.top-title-group, .btn-group, .timeline-box').forEach((el) => { el.style.pointerEvents = 'auto'; });
    resetHideTimer();
  }
};

/* ---- every panel closes: ×, tap outside, Escape ---- */
const panelScrim = $('panelScrim');
const slidePanels = () => [settingsModal, playerEpisodesDrawer, $('chaptersPanel')];
function closePanels() { slidePanels().forEach((p) => p && p.classList.remove('open')); }
function syncScrim() { panelScrim.classList.toggle('show', slidePanels().some((p) => p && p.classList.contains('open'))); }
if (panelScrim) {
  panelScrim.addEventListener('click', (e) => { e.stopPropagation(); closePanels(); });
  const mo = new MutationObserver(syncScrim);
  slidePanels().forEach((p) => p && mo.observe(p, { attributes: true, attributeFilter: ['class'] }));
}
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanels(); });
const closeSettingsBtn = $('closeSettingsBtn');
if (closeSettingsBtn) closeSettingsBtn.onclick = (e) => { e.stopPropagation(); settingsModal.classList.remove('open'); };
settingsBtn.onclick = (e) => {
  if (e) e.stopPropagation();
  if (isScreenLocked) return;
  playerEpisodesDrawer.classList.remove('open');
  settingsModal.classList.toggle('open');
  resetHideTimer();
};

let hideTimer = null;
function resetHideTimer() {
  if (isScreenLocked) {
    topOverlay.classList.remove('hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      topOverlay.classList.add('hidden');
    }, 5000);
    return;
  }

  topOverlay.classList.remove('hidden');
  bottomOverlay.classList.remove('hidden');
  playerWrapper.classList.remove('hud-hidden');
  clearTimeout(hideTimer);

  hideTimer = setTimeout(() => {
    if (settingsModal.classList.contains('open') || playerEpisodesDrawer.classList.contains('open') || $('chaptersPanel').classList.contains('open')) return;
    topOverlay.classList.add('hidden');
    bottomOverlay.classList.add('hidden');
    playerWrapper.classList.add('hud-hidden');
  }, 5000);
}

// Touch taps on the video are handled by the tap zones (show/hide toggle). If the wrapper also
// revealed the controls on touchstart, the zone's single-tap toggle would instantly hide them again.
playerWrapper.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') resetHideTimer(); });
[settingsModal, playerEpisodesDrawer, $('chaptersPanel'), panelScrim].forEach((el) => {
  if (!el) return;
  ['pointerdown', 'click'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation()));
});
[topOverlay, bottomOverlay, settingsModal, playerEpisodesDrawer, $('chaptersPanel')].forEach((el) => {
  ['pointerdown', 'click'].forEach((evt) => el.addEventListener(evt, resetHideTimer));
});

floatingEpisodesBtn.onclick = (e) => {
  if (e) e.stopPropagation();
  if (isScreenLocked) return;
  settingsModal.classList.remove('open');
  renderFloatingEpisodes();
  playerEpisodesDrawer.classList.toggle('open');
  resetHideTimer();
  const active = episodesDrawerList.querySelector('.drawer-ep-row.active');
  if (active && playerEpisodesDrawer.classList.contains('open')) {
    active.scrollIntoView({ block: 'center' });
  }
};
closeEpisodesDrawerBtn.onclick = () => playerEpisodesDrawer.classList.remove('open');

/* Keyboard shortcuts (desktop / external keyboard) */
document.addEventListener('keydown', (e) => {
  if (currentView !== 'player' || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
  if (isScreenLocked) return;

  let handled = true;
  switch (e.key) {
    case ' ':
    case 'k':
    case 'K': togglePlayPause(); break;
    case 'ArrowLeft':
    case 'j':
    case 'J': seekToTargetSecond(Math.max(0, absoluteTime() - prefs.seekStep)); break;
    case 'ArrowRight':
    case 'l':
    case 'L': seekToTargetSecond(Math.min((getDuration() || 99999) - 2, absoluteTime() + prefs.seekStep)); break;
    case 'ArrowUp': video.volume = clamp(video.volume + 0.1, 0, 1); break;
    case 'ArrowDown': video.volume = clamp(video.volume - 0.1, 0, 1); break;
    case 'm':
    case 'M': toggleMute(); break;
    case 'f':
    case 'F': toggleFullscreen(); break;
    case 'n':
    case 'N': playAdjacentEpisode(1); break;
    case 'p':
    case 'P': playAdjacentEpisode(-1); break;
    case 'Escape': settingsModal.classList.remove('open'); playerEpisodesDrawer.classList.remove('open'); $('chaptersPanel').classList.remove('open'); break;
    case ',': stepChapter(-1); break;
    case '.': stepChapter(1); break;
    case 'c':
    case 'C': toggleChaptersPanel(); break;
    case ']': stepSpeed(1); break;
    case '[': stepSpeed(-1); break;
    case 'z':
    case 'Z': setSubDelay(subDelay - 0.1, true); break;
    case 'x':
    case 'X': setSubDelay(subDelay + 0.1, true); break;
    default: handled = false;
  }
  if (handled) {
    e.preventDefault();
    resetHideTimer();
  }
});


/* ===== v1.25 Card Format (Title • S0E0 | + Description) & Long-Press Video Info ===== */
let customDescriptions = {};
fetch('/api/descriptions').then((r) => r.json()).then((d) => {
  customDescriptions = d || {};
  if (typeof renderInlinePlaylist === 'function') renderInlinePlaylist();
  if (typeof updateActiveEpisodeDescription === 'function') updateActiveEpisodeDescription();
}).catch(() => {});

function findCustomEpInfo(item) {
  if (typeof customDescriptions === "undefined" || !customDescriptions) return "";
  const name = typeof item === "string" ? item : (item && item.name) || "";
  const p = parseMedia(name);
  if (p.ep == null) return "";
  const normTitle = (p.title || "").toLowerCase();
  const seriesKey = Object.keys(customDescriptions).find((k) => normTitle.includes(k.toLowerCase()));
  if (!seriesKey) return "";
  const sKey = String(p.season || 1);
  const seasonObj = customDescriptions[seriesKey] && customDescriptions[seriesKey][sKey];
  const val = seasonObj && seasonObj[String(p.ep)];
  if (!val) return "";
  return typeof val === "string" ? val : (val.title || "");
}

function updateActiveEpisodeDescription() {
  const fileName = (activeVideoPath || "").split("/").pop() || "";
  const text = findCustomEpInfo(fileName) || "";
  const topEl = $("playerCurrentDesc");
  const pauseEl = $("pausedEpDesc");
  if (topEl) topEl.textContent = text;
  if (pauseEl) pauseEl.textContent = text;
}

function formatCardHeader(item) {
  const name = typeof item === "string" ? item : (item.name || "");
  const p = parseMedia(name);
  const pad = (n) => String(n).padStart(2, "0");
  const tag = p.ep == null ? "" : (p.season != null ? `S${pad(p.season)}E${pad(p.ep)}` : `E${pad(p.ep)}`);
  return { title: String(p.title || cleanMediaTitle(name)).replace(/[\s\u2022\u00b7\-\u2013\u2014_.]+$/, ''), tag };
}

function getCardDescription(item) {
  const epName = findCustomEpInfo(item);
  if (epName) return epName;
  if (!item || typeof item === "string") return "Local media stream";
  const parts = [];
  const p = parseMedia(item.name || "");
  if (p.tags && p.tags.length) parts.push(p.tags.slice(0, 2).join(" · "));
  if (prefs.listChips === false) { if (item.size) parts.push(item.size); }
  else parts.push(...fileChips(item));
  const prog = progressLabel(item);
  if (prog) parts.push(prog);
  return parts.length ? parts.join(" • ") : "Ready to play";
}

function showVideoInfoPopup(item, folderHint) {
  const old = document.getElementById("astraVidInfoModal");
  if (old) old.remove();
  const rel = item.relPath || item.fullPath || "";
  const name = item.name || rel.split("/").pop() || "Video";
  const { title, tag } = formatCardHeader(item);
  const h = historyCache[rel] || historyCache[item.fullPath] || null;
  const progStr = h && h.dur ? `${formatTime(h.time)} / ${formatTime(h.dur)} (${h.percent || 0}%)` : "Not watched yet";
  const folder = folderHint || findFolderForPath(rel, name) || "Storage";

  const host = document.fullscreenElement || document.body;
  const scrim = document.createElement("div");
  scrim.id = "astraVidInfoModal";
  scrim.className = "dlg-scrim";
  scrim.innerHTML = `
    <div class="dlg vid-info-dlg" role="dialog" aria-modal="true">
      <div class="vid-info-thumb"></div>
      <div class="vid-info-head">
        <span class="vid-info-title">${escapeHtml(title)}</span>
        ${tag ? `<span class="vid-info-tag">• ${escapeHtml(tag)} |</span>` : ""}
      </div>
      <p class="vid-info-desc">${escapeHtml(getCardDescription(item))}</p>
      <div class="vid-info-grid">
        <div><b>Folder:</b> <span>${escapeHtml(folder)}</span></div>
        <div><b>File:</b> <span>${escapeHtml(name)}</span></div>
        <div><b>Progress:</b> <span>${escapeHtml(progStr)}</span></div>
        ${item.size ? `<div><b>Size:</b> <span>${escapeHtml(String(item.size))}${item.mtime ? ' \u00b7 ' + escapeHtml(new Date(Number(item.mtime)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })) : ''}</span></div>` : ''}
        <div><b>Format:</b> <span>${escapeHtml((name.includes('.') ? name.split('.').pop() : '').toUpperCase() || '-')}</span></div>
      </div>
      <div class="dlg-act" style="margin-top:14px;">
        <button type="button" class="pill-btn vi-copy">Copy path</button>
        <button type="button" class="pill-btn vi-close">Close</button>
        <button type="button" class="pill-btn highlight vi-play">Play Video</button>
      </div>
    </div>`;
  const close = () => { scrim.classList.remove("on"); setTimeout(() => scrim.remove(), 160); };
  scrim.querySelector(".vi-close").onclick = close;
  scrim.querySelector(".vi-copy").onclick = () => { const full = item.fullPath || (libraryRoot ? libraryRoot.replace(/\/$/, '') + '/' + rel : rel); try { navigator.clipboard.writeText(full); showToast('Path copied', 1500, 'ok'); } catch (e) { showToast(full, 4000); } };
  scrim.querySelector(".vi-play").onclick = () => {
    close();
    inspectMediaAndPlay(name, rel, h ? resumeStartTime(h) : 0);
    navigateTo("player");
  };
  scrim.addEventListener("pointerdown", (e) => { if (e.target === scrim) close(); });
  host.appendChild(scrim);
  attachThumb(scrim.querySelector(".vid-info-thumb"), rel, "video", name);
  requestAnimationFrame(() => scrim.classList.add("on"));
}

function bindHoldVideoInfo(el, item, folderHint) {
  let holdTimer = null, moved = false, held = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.button && e.button !== 0) return;
    moved = false; held = false;
    holdTimer = setTimeout(() => {
      held = true;
      if (navigator.vibrate) try { navigator.vibrate(25); } catch (_) {}
      showVideoInfoPopup(item, folderHint);
    }, 520);
  });
  el.addEventListener("pointermove", () => { moved = true; clearTimeout(holdTimer); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => {
    el.addEventListener(ev, () => clearTimeout(holdTimer));
  });
  el.addEventListener("click", (e) => {
    if (held) { e.preventDefault(); e.stopImmediatePropagation(); held = false; }
  }, true);
}

/* ------------------------------------------------------------------ */
/* Episode lists                                                       */
/* ------------------------------------------------------------------ */
function progressLabel(item) {
  const h = historyCache[item.relPath] || historyCache[item.fullPath];
  if (!h) return '';
  const pct = Number(h.percent) || 0;
  if (pct >= 97) return '✓ Watched';
  return pct > 0 ? `${pct}% watched` : '';
}
/* File details like a file manager: NEW tag, size, date and "played 3 days ago". */
function agoText(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : d + ' days ago';
}
function fileChips(item) {
  const out = [];
  if (!item || prefs.listChips === false) return out;
  const m = Number(item.mtime) || 0;
  if (m && prefs.newDays > 0 && Date.now() - m < prefs.newDays * 86400000) out.push('NEW');
  if (item.size) out.push(item.size);
  if (m) { try { out.push(new Date(m).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })); } catch (e) {} }
  const h = historyCache[item.relPath] || historyCache[item.fullPath];
  if (h && Number(h.updated) > 0) out.push('Played ' + agoText(Number(h.updated)));
  return out;
}
function subLine(item) {
  const label = progressLabel(item);
  const parts = prefs.listChips === false ? [item.size, label] : [...fileChips(item), label];
  return escapeHtml(parts.filter(Boolean).join(' · '));
}

function renderFloatingEpisodes() {
  episodesDrawerList.innerHTML = '';
  const pBtn = $("prevEpBtn"), nBtn = $("nextEpBtn");
  const activeIdx = currentVideoList.findIndex(isActiveItem);
  if (pBtn) pBtn.disabled = activeIdx <= 0;
  if (nBtn) nBtn.disabled = activeIdx < 0 || activeIdx >= currentVideoList.length - 1;
  if (currentVideoList.length === 0) {
    episodesDrawerList.innerHTML = '<div class="empty-hint">No queue active. Pick a series from dashboard!</div>';
    return;
  }
  currentVideoList.forEach((item) => {
    const row = document.createElement('div');
    const isPlaying = isActiveItem(item);
    const rel = item.relPath || item.fullPath;
    const h = historyCache[item.relPath] || historyCache[item.fullPath];
    const pct = h ? Math.min(100, Number(h.percent) || 0) : 0;
    row.className = `drawer-ep-row drawer-ep-card ${isPlaying ? 'active' : ''}`;
    row.innerHTML = `
      <div class="drawer-ep-thumb history-thumb">${pct > 0 ? `<div class="history-bar" style="width:${pct}%"></div>` : ''}</div>
      <div class="drawer-ep-meta">
        <div class="drawer-ep-top">
          ${isPlaying ? '<span class="watching-pill">WATCHING</span>' : ''}
          <div class="drawer-ep-title">${escapeHtml(cleanMediaTitle(item.name))}</div>
        </div>
        <div class="drawer-ep-sub">${subLine(item)}</div>
      </div>`;
    row.onclick = () => {
      inspectMediaAndPlay(item.name, rel, 0);
      playerEpisodesDrawer.classList.remove('open');
      renderInlinePlaylist();
    };
    episodesDrawerList.appendChild(row);
    attachThumb(row.querySelector('.drawer-ep-thumb'), rel, 'video', item.name);
  });
}

// Episode label for a card: "S1 E3" from the file name, else "Episode N", else the cleaned name.
function epCardLabel(item) {
  const n = item.name || '';
  let m = /S(\d{1,2})\s*[ ._-]?E(?:P)?\s?(\d{1,4})/i.exec(n) || /(\d{1,2})x(\d{2,4})/i.exec(n);
  if (m) return `Episode s${+m[1]} e${+m[2]}`;
  m = /(?:episode|ep|e)\s*\.?\s*(\d{1,4})/i.exec(n) || /\s-\s(\d{1,4})(?:v\d)?(?=\s|\[|\(|$)/.exec(n);
  return m ? `Episode ${+m[1]}` : cleanMediaTitle(n);
}
// Season folders that belong to the same anime as the open folder: "Naruto / Season 1", "Naruto / Season 2" ...
function seasonSiblings() {
  if (currentPathTokens.length < 2) return [];
  const parent = currentPathTokens.slice(0, -1).join(' / ');
  return Object.keys(fullLibrary).filter((k) => k.split(' / ').slice(0, -1).join(' / ') === parent && k.split(' / ').length === currentPathTokens.length)
    .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
}
function seasonLabel(key) {
  const last = key.split(' / ').pop();
  const m = /^(?:s|season)\s*0*(\d+)$/i.exec(last.trim());
  return m ? `Season ${m[1]}` : last;
}
var IC_FILM = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="3"/><path d="M7 3v18M17 3v18M2 9h5M17 9h5M2 15h5M17 15h5"/></svg>';
var IC_SEASON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
function updatePlayerEmptyState() {
  const w = $('playerWrapper');
  if (w) w.classList.toggle('no-video', !activeVideoPath);
}
// "The Eminence in Shadow / The Eminence in Shadow S01" -> { name: "The Eminence in Shadow", label: "Season 1" }
function seasonInfo(key) {
  const tokens = key.split(' / '), last = tokens[tokens.length - 1] || '';
  const m = /(?:season|\bs)[\s._-]*0*(\d{1,2})\b/i.exec(last);
  return { name: tokens[0] || last, label: m ? `Season ${+m[1]}` : last };
}
// Card text: title, plus S1E2 only when the file name really has it ("E5" when only the episode is known)
function epCardParts(item) {
  const p = parseMedia(item.name || '');
  const tag = p.ep == null ? '' : (p.season != null ? `S${p.season}E${p.ep}` : `E${p.ep}`);
  return { title: p.title || cleanMediaTitle(item.name), tag };
}
function renderInlinePlaylist() {
  updatePlayerEmptyState();
  playerInlinePlaylist.innerHTML = '';
  const seasonSlot = $('playerSeasons'); seasonSlot.innerHTML = '';
  if (currentVideoList.length === 0) {
    playerInlinePlaylist.innerHTML = '<div class="empty-hint">Select a series to view episodes</div>';
    return;
  }
  const n = currentVideoList.length;
  playerShelfTitle.innerHTML = IC_FILM + '<span></span><small></small>';
  playerShelfTitle.querySelector('span').textContent = curSeriesName() || 'Active Queue';
  playerShelfTitle.querySelector('small').textContent = `${n} ${n === 1 ? 'video' : 'videos'}`;

  // Season boxes: series name (bigger) over "Season N" (smaller), scrolling sideways
  const seasons = seasonSiblings();
  if (seasons.length > 0) {
    const row = document.createElement('div'); row.className = 'season-row';
    const here = currentPathTokens.join(' / ');
    seasons.forEach((k) => {
      const info = seasonInfo(k);
      const bt = document.createElement('button');
      bt.className = 'season-box' + (k === here ? ' active' : '');
      bt.innerHTML = '<span class="sb-name"></span><span class="sb-sub">' + IC_SEASON + '<span></span></span>';
      bt.querySelector('.sb-name').textContent = info.name;
      bt.querySelector('.sb-sub span').textContent = info.label;
      bt.title = `${info.name} \u00b7 ${info.label}`;
      bt.onclick = () => { currentPathTokens = k.split(' / '); currentVideoList = fullLibrary[k]; renderInlinePlaylist(); renderFloatingEpisodes(); };
      row.appendChild(bt);
    });
    seasonSlot.appendChild(row);
    const on = row.querySelector('.active'); if (on) requestAnimationFrame(() => { row.scrollLeft = Math.max(0, on.offsetLeft - 16); });
  }

  const list = document.createElement('div');
  list.className = 'q-list q-v';
  currentVideoList.forEach((item) => {
    const isPlaying = isActiveItem(item);
    const rel = item.relPath || item.fullPath;
    const { title, tag } = formatCardHeader(item);
    const desc = getCardDescription(item);
    const card = document.createElement('div');
    card.className = `q-card bordered-media-card${isPlaying ? ' playing' : ''}`;
    card.innerHTML = `
      <div class="q-thumb history-thumb">${isPlaying ? '<span class="q-now"><i></i><i></i><i></i>Playing</span>' : ''}</div>
      <div class="media-card-body">
        <div class="q-name"><span class="q-title"></span>${tag ? `<span class="q-ep">• ${escapeHtml(tag)} |</span>` : ''}</div>
        <div class="media-card-desc"></div>
      </div>`;
    card.querySelector('.q-title').textContent = title;
    card.querySelector('.media-card-desc').textContent = desc;
    card.title = cleanMediaTitle(item.name);
    card.onclick = () => { inspectMediaAndPlay(item.name, rel, 0); renderInlinePlaylist(); };
    bindHoldVideoInfo(card, item, currentPathTokens.join(" / "));
    list.appendChild(card);
    attachThumb(card.querySelector('.q-thumb'), rel, 'video', item.name);
  });
  playerInlinePlaylist.appendChild(list);
}

/* ------------------------------------------------------------------ */
/* Subtitle file picker                                                */
/* ------------------------------------------------------------------ */
function playingFolder() {
  const p = activeVideoPath || ''; const i = p.lastIndexOf('/');
  if (i <= 0) return '';
  const d = p.slice(0, i);
  return d.startsWith('/') ? d : (libraryRoot ? libraryRoot.replace(/\/$/, '') + '/' + d : '');
}
async function openSubFolderPicker(dir = '') {
  const modal = $('subPickerModal');
  // In fullscreen the player covers the page: the picker must live inside the fullscreen element to be seen.
  const host = toastHost();
  if (modal.parentNode !== host) host.appendChild(modal);
  modal.style.zIndex = host === document.body ? '' : '700';
  try { closePanels(); } catch (e) {}
  modal.style.pointerEvents = 'auto';
  modal.classList.add('open');
  const list = $('subPickerList');
  try {
    const targetDir = dir || playingFolder() || currentBrowsingDir || '';
    const res = await fetch(`/api/storage/explore?dir=${encodeURIComponent(targetDir)}`);
    const data = await res.json();
    if (!res.ok || !data.folders) throw new Error(data.error || 'Cannot read folder');
    if (subPickerPathInputField) subPickerPathInputField.value = data.current;
    list.innerHTML = '';

    const upRow = document.createElement('div');
    upRow.className = 'explorer-row';
    upRow.innerHTML = '<div class="row-left"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><div class="row-title">Parent folder</div></div><span class="row-badge">Up</span>';
    upRow.onclick = () => openSubFolderPicker(data.parent || data.current);
    list.appendChild(upRow);

    data.folders.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'explorer-row';
      row.innerHTML = `<div class="row-left"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><div class="row-title">${escapeHtml(f.name)}</div></div><span class="row-badge">Open</span>`;
      row.onclick = () => openSubFolderPicker(f.fullPath);
      list.appendChild(row);
    });

    if (!data.files.some((f) => f.type === 'sub') && !data.folders.length) { const e = document.createElement('div'); e.className = 'empty-hint'; e.textContent = 'No subtitle files in this folder'; list.appendChild(e); }
    data.files.filter((f) => f.type === 'sub').forEach((f) => {
      const row = document.createElement('div');
      row.className = 'explorer-row';
      row.innerHTML = `<div class="row-left"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 12h4M13 12h5M6 15.5h7"/></svg><div class="row-title">${escapeHtml(f.name)}${f.size ? `<small class="row-sub">${escapeHtml(f.size)}</small>` : ''}</div></div><span class="row-badge">Select</span>`;
      row.onclick = () => {
        addExternalSubtitle(f.name, f.fullPath);
        $('subPickerModal').classList.remove('open');
      };
      list.appendChild(row);
    });
  } catch (e) {
    list.innerHTML = `<div class="empty-hint">${escapeHtml(e.message || 'Cannot read folder')}</div>`;
  }
}

$('btnAttachSubtitleFolder').onclick = () => $('btnOpenSubPickerModal').click();
/* In fullscreen the folder picker can hide behind the player, so use the phone's own file chooser there */
(function () {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.srt,.vtt,.ass,.ssa,text/*,application/x-subrip'; inp.style.display = 'none'; document.body.appendChild(inp);
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    try {
      const text = await f.text();
      const r = await fetch('/api/subs/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.name, text }) });
      const d = await r.json(); if (!r.ok || !d.path) throw new Error(d.error || 'Could not read the file');
      addExternalSubtitle(d.name || f.name, d.path); showToast({ title: 'Subtitle added', sub: f.name }, 2500, 'ok');
    } catch (e) { showToast(e.message || 'Could not add the subtitle', 3500); }
  };
  const inFs = () => !!(fakeFs || (document.fullscreenElement && document.fullscreenElement !== document.documentElement));
  $('btnOpenSubPickerModal').onclick = () => { if (inFs()) { try { closePanels(); } catch (e) {} inp.click(); } else openSubFolderPicker(); };
})();
['pointerdown', 'click', 'touchstart'].forEach((t) => $('subPickerModal').addEventListener(t, (e) => e.stopPropagation()));
$('closeSubPickerModalBtn').onclick = () => $('subPickerModal').classList.remove('open');

if (btnGoSubPickerInput && subPickerPathInputField) {
  btnGoSubPickerInput.onclick = () => {
    const p = subPickerPathInputField.value.trim();
    if (p) openSubFolderPicker(p);
  };
  subPickerPathInputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const p = subPickerPathInputField.value.trim();
      if (p) openSubFolderPicker(p);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Folder explorer                                                     */
/* ------------------------------------------------------------------ */
let fmData = null;
const FM_IC = {
  folder: '<svg class="fm-ic" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  video: '<svg class="fm-ic" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><polygon points="10 9 16 12 10 15 10 9" fill="#a78bfa"/></svg>',
  sub: '<svg class="fm-ic" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 12h4M13 12h5M6 15.5h7"/></svg>',
  chev: '<svg class="fm-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>'
};
const fmHidden = () => { try { return localStorage.getItem('astra_show_hidden') === '1'; } catch (e) { return false; } };
function fmNameHtml(name) {
  const i = name.lastIndexOf('.');
  const a = i > 0 && name.length - i <= 6 ? name.slice(0, i) : name, b = a === name ? '' : name.slice(i);
  return `<span class="fn-a">${escapeHtml(a)}</span><span class="fn-b">${escapeHtml(b)}</span>`;
}
function fmCounts(c) {
  if (!c) return '';
  const p = [];
  if (c.nf) p.push(c.nf + (c.nf === 1 ? ' folder' : ' folders'));
  if (c.nv) p.push(c.nv + (c.nv === 1 ? ' video' : ' videos'));
  if (c.ns) p.push(c.ns + (c.ns === 1 ? ' subtitle' : ' subtitles'));
  return p.length ? p.join(' \u00b7 ') : 'Empty';
}
let fmSearchRes = null, fmSearchTimer = 0, fmSearchSeq = 0;
function fmPermCard() {
  try { if (!(window.AstraNative && AstraNative.hasStorage) || AstraNative.hasStorage()) return ''; } catch (e) { return ''; }
  return '<div class="fm-perm"><b>Storage access is off</b><span>Astra Player needs "All files access" to show your videos and folders.</span><button type="button" class="pill-btn highlight" id="fmGrant">Grant permission</button></div>';
}
function fmBindPerm(container) { const b = container.querySelector('#fmGrant'); if (b) b.onclick = () => { try { AstraNative.grantStorage(); } catch (e) {} }; }
function renderExplorer() {
  const container = $('explorerContent'); if (!fmData) return;
  const qq = ($('fmSearch').value || '').trim().toLowerCase();
  if (qq.length >= 2 && fmSearchRes && fmSearchRes.q === qq) { renderSearchResults(container, fmSearchRes.data); return; }
  const data = fmData, q = ($('fmSearch').value || '').trim().toLowerCase(), showHid = fmHidden();
  const ok = (n) => (showHid || !n.startsWith('.')) && (!q || n.toLowerCase().includes(q));
  const folders = data.folders.filter((f) => ok(f.name)), files = data.files.filter((f) => ok(f.name));
  const videosHere = data.files.filter((f) => f.type === 'video');
  container.innerHTML = '';
  folders.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'explorer-row fm-row';
    row.innerHTML = `${FM_IC.folder}<div class="fm-main"><div class="fm-name">${fmNameHtml(f.name).replace('class="fn-a"', 'class="fn-a full"')}</div><div class="fm-meta">${fmCounts(f.counts)}</div></div>${FM_IC.chev}`;
    row.onclick = () => { $('fmSearch').value = ''; fmSearchRes = null; exploreFolder(f.fullPath); };
    container.appendChild(row);
  });
  files.forEach((f) => {
    const isVid = f.type === 'video';
    const row = document.createElement('div');
    row.className = 'explorer-row fm-row';
    const ext = (f.name.includes('.') ? f.name.split('.').pop() : '').toUpperCase();
    const m = Number(f.mtime) || 0;
    const isNew = m && prefs.newDays > 0 && Date.now() - m < prefs.newDays * 86400000;
    const h = isVid ? (historyCache[f.relPath] || historyCache[f.fullPath]) : null;
    const meta = [];
    if (f.size) meta.push('Size: ' + escapeHtml(f.size));
    if (m) { try { meta.push(new Date(m).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })); } catch (e) {} }
    if (ext) meta.push(ext);
    if (h && Number(h.updated) > 0) meta.push('Played ' + agoText(Number(h.updated)));
    row.innerHTML = `${isVid ? FM_IC.video : FM_IC.sub}<div class="fm-main"><div class="fm-name">${fmNameHtml(f.name)}</div><div class="fm-meta">${isNew ? '<b class="fm-new">NEW</b>' : ''}${meta.join(' · ')}</div></div>`;
    row.onclick = () => {
      if (isVid) playFromExplorer(f, videosHere, data.current);
      else { addExternalSubtitle(f.name, f.fullPath); showToast(`Subtitle attached: ${f.name}`, 2000); }
    };
    if (isVid) bindHoldVideoInfo(row, f, data.current);
    container.appendChild(row);
  });
  if (!folders.length && !files.length) container.innerHTML = `<div class="empty-hint">${q ? 'Nothing matches your search' : 'No folders, videos or subtitles here'}</div>`;
  const pc = fmPermCard(); if (pc) { container.insertAdjacentHTML('afterbegin', pc); fmBindPerm(container); }
}
function renderSearchResults(container, d) {
  container.innerHTML = '';
  const hid = fmHidden(); const folders = d.folders || [], files = d.files || [];
  const where = (pth) => escapeHtml(String(pth || '').replace(/^\/storage\/emulated\/0\/?/, '') || 'Phone storage');
  folders.forEach((f) => {
    const row = document.createElement('div'); row.className = 'explorer-row fm-row';
    row.innerHTML = `${FM_IC.folder}<div class="fm-main"><div class="fm-name">${fmNameHtml(f.name).replace('class="fn-a"', 'class="fn-a full"')}</div><div class="fm-meta">${fmCounts(f.counts)}</div><div class="fm-meta fm-where">in ${where(f.parent)}</div></div>${FM_IC.chev}`;
    row.onclick = () => { $('fmSearch').value = ''; fmSearchRes = null; exploreFolder(f.fullPath); };
    container.appendChild(row);
  });
  files.forEach((f) => {
    const isVid = f.type === 'video'; const row = document.createElement('div'); row.className = 'explorer-row fm-row';
    row.innerHTML = `${isVid ? FM_IC.video : FM_IC.sub}<div class="fm-main"><div class="fm-name">${fmNameHtml(f.name)}</div><div class="fm-meta">${escapeHtml(f.size || '')}</div><div class="fm-meta fm-where">in ${where(f.parent)}</div></div>`;
    row.onclick = () => {
      if (isVid) { playFromExplorer(f, [f], f.parent); }
      else { addExternalSubtitle(f.name, f.fullPath); showToast(`Subtitle attached: ${f.name}`, 2000); }
    };
    if (isVid) bindHoldVideoInfo(row, f, f.parent);
    container.appendChild(row);
  });
  if (!folders.length && !files.length) container.innerHTML = '<div class="empty-hint">Nothing found in the whole storage</div>';
  else container.insertAdjacentHTML('afterbegin', `<div class="fm-found">${folders.length} folders \u00b7 ${files.length} files found in all storage</div>`);
}
function fmRunSearch() {
  const q = ($('fmSearch').value || '').trim().toLowerCase();
  clearTimeout(fmSearchTimer);
  if (q.length < 2) { fmSearchRes = null; renderExplorer(); return; }
  fmSearchTimer = setTimeout(async () => {
    const seq = ++fmSearchSeq;
    try {
      const r = await fetch(`/api/storage/search?q=${encodeURIComponent(q)}&hidden=${fmHidden() ? 1 : 0}`);
      const d = await r.json();
      if (seq !== fmSearchSeq || ($('fmSearch').value || '').trim().toLowerCase() !== q) return;
      fmSearchRes = { q, data: d }; renderExplorer();
    } catch (e) {}
  }, 350);
}
async function exploreFolder(dirPath = '') {
  const container = $('explorerContent');
  try {
    const targetDir = dirPath || currentBrowsingDir || '';
    const res = await fetch(`/api/storage/explore?dir=${encodeURIComponent(targetDir)}`);
    const data = await res.json();
    if (!res.ok || !data.folders) throw new Error(data.error || 'Cannot read folder');
    currentBrowsingDir = data.current;
    currentParentDir = data.parent || '';
    if (storagePathInputField) storagePathInputField.value = data.current;
    $('fmCrumb').textContent = data.current;
    fmData = data;
    renderExplorer();
  } catch (e) {
    fmData = null;
    container.innerHTML = fmPermCard() + `<div class="empty-hint">${escapeHtml(e.message || 'Cannot read folder')}</div>`;
    fmBindPerm(container);
  }
}
{
  const sb = $('fmShowHidden');
  const paint = () => { sb.setAttribute('aria-pressed', fmHidden() ? 'true' : 'false'); sb.classList.toggle('on', fmHidden()); };
  paint();
  sb.onclick = () => { try { localStorage.setItem('astra_show_hidden', fmHidden() ? '0' : '1'); } catch (e) {} paint(); renderExplorer(); };
  $('fmSearch').addEventListener('input', () => { renderExplorer(); fmRunSearch(); });
}

function playFromExplorer(file, videosHere, folderPath) {
  // Prefer the library entry (keeps one history key per episode and the proper series queue).
  const folder = findFolderForPath(file.fullPath);
  if (folder !== null) {
    currentPathTokens = folder === 'Anime Root' ? [] : folder.split(' / ');
    currentVideoList = fullLibrary[folder];
    const item = currentVideoList.find((v) => v.fullPath === file.fullPath);
    inspectMediaAndPlay(item.name, item.relPath || item.fullPath, 0);
  } else {
    currentPathTokens = [folderPath.split('/').filter(Boolean).pop() || 'Storage'];
    currentVideoList = videosHere.map((v) => ({ name: v.name, relPath: v.fullPath, fullPath: v.fullPath, size: '' }));
    inspectMediaAndPlay(file.name, file.fullPath, 0);
  }
  navigateTo('player');
}

if (btnGoPathInput && storagePathInputField) {
  btnGoPathInput.onclick = () => {
    const p = storagePathInputField.value.trim();
    if (p) exploreFolder(p);
  };
  storagePathInputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const p = storagePathInputField.value.trim();
      if (p) exploreFolder(p);
    }
  });
}

$('btnStorageGoParent').onclick = () => {
  if (currentParentDir && currentParentDir !== currentBrowsingDir) {
    exploreFolder(currentParentDir);
  } else if (currentBrowsingDir) {
    const parts = currentBrowsingDir.split('/').filter(Boolean);
    parts.pop();
    exploreFolder('/' + parts.join('/'));
  }
};

$('btnSetAsMediaRoot').onclick = async () => {
  if (!currentBrowsingDir) return;
  try {
    const res = await fetch('/api/settings/root', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPath: currentBrowsingDir })
    });
    const data = await res.json();
    if (data.success) {
      libraryRoot = data.root;
      fullLibrary = data.library || {};
      await loadCustomThumbs();
      renderDashboard();
      renderHistory();
      const eps = Object.values(fullLibrary).reduce((n, list) => n + list.length, 0);
      showToast(`Media root set — ${eps} episode${eps === 1 ? '' : 's'} found`);
    } else {
      showToast(data.message || 'Could not set media root');
    }
  } catch (e) {
    showToast('Could not reach the server');
  }
};

$('btnPickFolderBrowse').onclick = () => {
  exploreFolder(libraryRoot || currentBrowsingDir || '');
  navigateTo('library');
};

/* ------------------------------------------------------------------ */
/* Hardware telemetry (1.5s pulse + Linear/Raycast style HUD graph)   */
/* ------------------------------------------------------------------ */
const ramDataPoints = new Array(32).fill(0);
const cpuDataPoints = new Array(32).fill(0);
const timeDataPoints = new Array(32).fill('--:--:--');
let telemetryBusy = false;
let selectedPointIdx = -1;
let selectedClearTimer = null;
let pulseRingPhase = 0;

function formatClockNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function drawTelemetrySeries(ctx, pts, W, H, padL, padR, padT, padB, maxVal, color, topRgba) {
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const coords = pts.map((val, idx) => ({
    x: padL + (idx / (pts.length - 1)) * plotW,
    y: padT + plotH - (Math.min(maxVal, Math.max(0, val)) / (maxVal || 1)) * plotH
  }));

  // Translucent vertical gradient fill
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  grad.addColorStop(0, topRgba);
  grad.addColorStop(1, 'rgba(5, 8, 17, 0.0)');

  ctx.beginPath();
  ctx.moveTo(coords[0].x, padT + plotH);
  ctx.lineTo(coords[0].x, coords[0].y);
  for (let i = 0; i < coords.length - 1; i++) {
    const xc = (coords[i].x + coords[i + 1].x) / 2;
    const yc = (coords[i].y + coords[i + 1].y) / 2;
    ctx.quadraticCurveTo(coords[i].x, coords[i].y, xc, yc);
  }
  const last = coords[coords.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.lineTo(last.x, padT + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Crisp glowing stroke
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  for (let i = 0; i < coords.length - 1; i++) {
    const xc = (coords[i].x + coords[i + 1].x) / 2;
    const yc = (coords[i].y + coords[i + 1].y) / 2;
    ctx.quadraticCurveTo(coords[i].x, coords[i].y, xc, yc);
  }
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();

  // Animated sonar ring + glowing dot on latest point
  const ringR = 4 + (pulseRingPhase % 10) * 0.7;
  const ringAlpha = Math.max(0, 0.65 - (pulseRingPhase % 10) * 0.065);
  ctx.beginPath();
  ctx.arc(last.x, last.y, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.globalAlpha = ringAlpha;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();

  return coords;
}

function renderTelemetryCanvas() {
  if (!ramGraphCanvas) return;
  const ctx = ramGraphCanvas.getContext('2d');
  const W = ramGraphCanvas.width;
  const H = ramGraphCanvas.height;
  const padL = 38, padR = 14, padT = 22, padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Deep obsidian canvas background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#070b14');
  bg.addColorStop(1, '#04060c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Dot-matrix background pattern (Linear / Vercel style)
  ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
  for (let gx = padL; gx <= W - padR; gx += 20) {
    for (let gy = padT; gy <= padT + plotH; gy += 20) {
      ctx.fillRect(gx, gy, 1.2, 1.2);
    }
  }

  // Horizontal reference lines + Y-axis labels
  ctx.font = '600 10px ui-monospace, Menlo, monospace';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.22)';
  ctx.lineWidth = 1;
  [0, 0.5, 1].forEach((t) => {
    const y = Math.round(padT + plotH * (1 - t));
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillText(`${Math.round(t * 100)}%`, 6, y + 3);
  });

  // Bottom time axis labels
  ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.fillText(timeDataPoints[0] || '', padL, H - 6);
  const midIdx = Math.floor(timeDataPoints.length / 2);
  ctx.fillText(timeDataPoints[midIdx] || '', padL + plotW * 0.45, H - 6);
  ctx.fillText(timeDataPoints[timeDataPoints.length - 1] || '', W - padR - 54, H - 6);

  // Top-right mini HUD readout inside graph
  const curRam = ramDataPoints[ramDataPoints.length - 1] || 0;
  const curCpu = cpuDataPoints[cpuDataPoints.length - 1] || 0;
  const peakRam = Math.max(...ramDataPoints, 1);
  ctx.font = '700 11px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`RAM ${curRam.toFixed(1)}MB (Peak ${peakRam.toFixed(0)}MB)`, padL, 14);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`CPU ${curCpu}%`, W - padR - 64, 14);

  const maxRam = Math.max(peakRam * 1.25, 100);
  const ramCoords = drawTelemetrySeries(ctx, ramDataPoints, W, H, padL, padR, padT, padB, maxRam, '#38bdf8', 'rgba(56, 189, 248, 0.28)');
  const cpuCoords = drawTelemetrySeries(ctx, cpuDataPoints, W, H, padL, padR, padT, padB, 100, '#fbbf24', 'rgba(251, 191, 36, 0.24)');

  // Interactive tap/click inspector card
  if (selectedPointIdx >= 0 && selectedPointIdx < ramCoords.length) {
    const rc = ramCoords[selectedPointIdx];
    const cc = cpuCoords[selectedPointIdx];
    const x = rc.x;

    ctx.save();
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    [
      { pt: rc, col: '#38bdf8' },
      { pt: cc, col: '#fbbf24' }
    ].forEach(({ pt, col }) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });

    const boxW = 152;
    const boxH = 56;
    const boxX = Math.min(W - padR - boxW, Math.max(padL, x - boxW / 2));
    const boxY = padT + 4;

    ctx.fillStyle = 'rgba(9, 13, 24, 0.95)';
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    else ctx.rect(boxX, boxY, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 11px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`TIME  ${timeDataPoints[selectedPointIdx]}`, boxX + 10, boxY + 16);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`RAM   ${ramDataPoints[selectedPointIdx].toFixed(1)} MB`, boxX + 10, boxY + 33);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`CPU   ${cpuDataPoints[selectedPointIdx]}%`, boxX + 10, boxY + 49);
    ctx.restore();
  }
}

if (ramGraphCanvas) {
  ramGraphCanvas.style.cursor = 'crosshair';
  ramGraphCanvas.addEventListener('pointerdown', (e) => {
    const rect = ramGraphCanvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / (rect.width || 1)) * ramGraphCanvas.width;
    const padL = 38, padR = 14;
    const plotW = ramGraphCanvas.width - padL - padR;
    const ratio = Math.min(1, Math.max(0, (clickX - padL) / (plotW || 1)));
    selectedPointIdx = Math.round(ratio * (ramDataPoints.length - 1));
    renderTelemetryCanvas();
    clearTimeout(selectedClearTimer);
    selectedClearTimer = setTimeout(() => {
      selectedPointIdx = -1;
      renderTelemetryCanvas();
    }, 5000);
  });
}

async function pulseHardwareGraph(force = false) {
  if (!force && (currentView !== 'settings' || document.hidden || telemetryBusy)) return;
  telemetryBusy = true;
  try {
    const res = await fetch('/api/system/status', { cache: 'no-store' });
    const data = await res.json();

    const badge = $('telemetryLatencyBadge');
    if (badge) badge.textContent = 'LIVE 1.5s';

    if (ramStatsText) {
      ramStatsText.textContent = `CPU: ${data.cpuPercent}%  •  App RAM: ${data.ramUsedMB} MB  •  Sys: ${data.usedSysMemMB}/${data.totalSysMemMB} MB`;
    }

    const ramVal = parseFloat(data.ramUsedMB) || 0;
    const cpuVal = parseFloat(data.cpuPercent) || 0;
    const nowStr = formatClockNow();

    // Seed initial baseline on first sample so graph starts cleanly without a 0-spike
    if (timeDataPoints[timeDataPoints.length - 1] === '--:--:--') {
      ramDataPoints.fill(ramVal);
      cpuDataPoints.fill(cpuVal);
      timeDataPoints.fill(nowStr);
    } else {
      ramDataPoints.push(ramVal);
      ramDataPoints.shift();
      cpuDataPoints.push(cpuVal);
      cpuDataPoints.shift();
      timeDataPoints.push(nowStr);
      timeDataPoints.shift();
    }

    pulseRingPhase++;
    if (selectedPointIdx > 0) selectedPointIdx--;
    renderTelemetryCanvas();
  } catch (e) {
    /* server unreachable */
  } finally {
    telemetryBusy = false;
  }
}

setInterval(() => pulseHardwareGraph(false), 1500);
// Trigger immediately when navigating to Settings
document.querySelectorAll('[data-hash="settings"]').forEach((btn) => {
  btn.addEventListener('click', () => setTimeout(() => pulseHardwareGraph(true), 60));
});
if ((window.location.hash || '').includes('settings')) {
  setTimeout(() => pulseHardwareGraph(true), 120);
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */
/* Deep links: #player/<series>/<season>/<episode>  e.g. #player/The+Eminence+in+Shadow/season-1/episode-3 */
const urlSlug = (x) => encodeURIComponent(String(x).trim().replace(/\s+/g, '+')).replace(/%2B/gi, '+');
const unSlug = (x) => { const t = String(x || '').replace(/\+/g, ' '); try { return decodeURIComponent(t); } catch (e) { return t; } };
const normSlug = (x) => unSlug(x).toLowerCase().replace(/[\s_\-.]+/g, ' ').trim();   // 'anime+name', 'anime_name', 'Anime-Name' all match
function seasonSlugOf(key) {
  const tokens = key === 'Anime Root' ? [] : key.split(' / ').slice(1);
  if (!tokens.length) return 'season-1';
  const m = /(?:season|\bs)[\s._-]*0*(\d{1,2})\b/i.exec(tokens.join(' '));
  return m ? `season-${Number(m[1])}` : urlSlug(tokens.join(' - ')).toLowerCase();
}
function deepLinkFor(relPath) {
  if (!relPath) return '';
  const key = currentPathTokens.join(' / ') || 'Anime Root';
  const eps = fullLibrary[key];
  if (!eps) return '';
  const idx = eps.findIndex((e) => (e.relPath || e.fullPath) === relPath);
  if (idx < 0) return '';
  const series = key === 'Anime Root' ? 'Anime Root' : (cleanSeriesQuery(key) || key.split(' / ')[0]);
  const n = parseMedia(eps[idx].name).ep;
  const unique = n != null && eps.filter((e) => parseMedia(e.name).ep === n).length === 1;
  return `#player/${urlSlug(series)}/${seasonSlugOf(key)}/episode-${unique ? n : idx + 1}`;
}
function resolveDeepLink(raw) {
  const parts = String(raw || '').replace(/^#/, '').split('/');
  if (parts[0] !== 'player' || parts.length < 4) return null;
  const wantSeries = normSlug(parts[1]), wantSeason = String(parts[2]).toLowerCase(), m = /^episode-(\d+)$/i.exec(parts[3]);
  if (!m) return null;
  const n = Number(m[1]);
  const key = Object.keys(fullLibrary).find((k) => normSlug(urlSlug(k === 'Anime Root' ? 'Anime Root' : (cleanSeriesQuery(k) || k.split(' / ')[0]))) === wantSeries && seasonSlugOf(k) === wantSeason);
  if (!key) return null;
  const eps = fullLibrary[key];
  const byNum = eps.filter((e) => parseMedia(e.name).ep === n);
  const ep = byNum.length === 1 ? byNum[0] : eps[n - 1];
  return ep ? { key, ep } : null;
}
function syncDeepLink(relPath) {
  const h = deepLinkFor(relPath);
  if (h && window.location.hash !== h) { try { history.replaceState(null, '', h); } catch (e) {} }
}
let pendingDeepLink = null;
async function openDeepLink(raw) {
  const r = resolveDeepLink(raw);
  if (!r) { showToast('That episode was not found in your library', 3500); navigateTo('home'); return; }
  const path = r.ep.relPath || r.ep.fullPath;
  if (currentView === 'player' && activeVideoPath === path) return;
  currentPathTokens = r.key === 'Anime Root' ? [] : r.key.split(' / ');
  currentVideoList = fullLibrary[r.key];
  const h = historyCache[path];
  navigateTo('player');
  renderInlinePlaylist();
  inspectMediaAndPlay(r.ep.name, path, h ? resumeStartTime(h) : 0);
}

let lastNonSettings = 'home';
let lastResumeFn = null;
function syncFloatResume() {
  const b = $('floatResume'); if (!b) return;
  b.hidden = !(prefs.floatResume !== false && typeof lastResumeFn === 'function' && currentView !== 'player' && currentView !== 'settings');
}
let viewHist = [];
function navigateTo(hash, noPush) {
  const raw = String(hash || '').replace(/^#/, '') || 'home';
  let target = raw.split('/')[0];
  if (!$(`view-${target}`)) target = 'home';
  if (target !== 'player') triggerAutoPause();

  const prevView = currentView;
  if (!noPush && prevView && prevView !== target) { viewHist.push(prevView); if (viewHist.length > 25) viewHist.shift(); }
  currentView = target;
  if (target === 'settings' && prevView !== 'settings' && window.astraSetSec) window.astraSetSec('home');
  document.body.classList.toggle('on-settings', target === 'settings');
  setTimeout(syncFloatResume, 0);
  if (target !== 'settings') lastNonSettings = target;
  document.querySelectorAll('#appTabbar button').forEach((b) => b.classList.toggle('active', b.dataset.hash === target));
  const keepDeep = target === 'player' && /^#player\//.test(window.location.hash);
  if (!keepDeep && window.location.hash !== `#${target}`) window.location.hash = target;
  document.querySelectorAll('.page-view').forEach((p) => p.classList.remove('active'));

  const view = $(`view-${target}`);
  if (view) view.classList.add('active');
  window.scrollTo(0, 0); // each page opens at its top (the player must never land off-screen)

  if (target === 'home') { renderDashboard(homeQuickSearch ? homeQuickSearch.value.trim() : ''); renderHistory(); }
  if (target === 'player') { renderInlinePlaylist(); if (activeVideoPath) syncDeepLink(activeVideoPath); liteEnterPlayer(); }
  else liteLeavePlayer();
  if (target === 'library') exploreFolder(libraryRoot || currentBrowsingDir || '');
  if (target === 'tasks') refreshTasks();
}
window.addEventListener('hashchange', () => {
  const raw = (window.location.hash || '').replace(/^#/, '') || 'home';
  if (raw.startsWith('player/')) { openDeepLink(raw); return; }
  const t = raw.split('/')[0];
  if (t !== currentView) navigateTo(t); // skip the echo of our own hash update
});
$('headerSettingsBtn').onclick = () => navigateTo(currentView === 'settings' ? (lastNonSettings || 'home') : 'settings');   // the gear turns into a close button
$('headerLogoBtn').onclick = () => navigateTo('home');
document.querySelectorAll('#appTabbar button').forEach((b) => { b.onclick = () => navigateTo(b.dataset.hash); });

/* Phone back button (called by the app): close the top-most thing first, then step back. Returns true when it did something. */
window.astraBack = function () {
  const dlg = document.querySelector('.dlg-scrim.on');
  if (dlg) { const c = dlg.querySelector('.dlg-cancel'); if (c) c.click(); return true; }
  if (window.__closePop && window.__closePop()) return true;
  const mb = document.querySelector('.modal-backdrop.open');
  if (mb) { mb.classList.remove('open'); return true; }
  if (closeSeriesPage()) return true;
  const panels = [settingsModal, playerEpisodesDrawer, $('chaptersPanel')];
  for (const p of panels) if (p && p.classList.contains('open')) { p.classList.remove('open'); return true; }
  if (typeof isScreenLocked !== 'undefined' && isScreenLocked) return true;
  if (document.fullscreenElement || (typeof fakeFs !== 'undefined' && fakeFs)) { toggleFullscreen(); return true; }
  if (currentView === 'settings') {
    const sv = $('view-settings');
    if (sv.dataset.sec !== 'home') { window.astraSetSec('home'); return true; }
    navigateTo(lastNonSettings || 'home', true); return true;
  }
  if (currentView === 'library' && currentParentDir && currentBrowsingDir && currentBrowsingDir !== libraryRoot) { exploreFolder(currentParentDir); return true; }
  if (currentView !== 'home') {
    const prev = viewHist.pop();
    navigateTo(prev && prev !== currentView ? prev : 'home', true); return true;
  }
  return false;   // already on the home page: the app goes to the background instead of closing
};

document.querySelectorAll('.modal-tabs .tab-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('.modal-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-body').forEach((b) => b.classList.remove('show'));
    btn.classList.add('active');
    $(btn.dataset.target).classList.add('show');
  };
});

if (homeQuickSearch) {
  let searchTimer = null;
  homeQuickSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchTimer);
      renderDashboard(homeQuickSearch.value.trim());
    }
  });
  homeQuickSearch.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    searchTimer = setTimeout(() => renderDashboard(q), 150);
  });
}

/* ------------------------------------------------------------------ */
/* Library, dashboard, history                                         */
/* ------------------------------------------------------------------ */
// Opening the site always starts on Home. Only a deep link (#player/series/season/episode) starts an episode.
function restoreSessionState() {
  if (sessionRestoreDone) return;
  sessionRestoreDone = true;
  if (pendingDeepLink) { const d = pendingDeepLink; pendingDeepLink = null; openDeepLink(d); return; }
  // Show the last watched video in the player (paused, at its saved position)
  try {
    const keys = Object.keys(historyCache || {}).sort((a, b) => (historyCache[b].updated || 0) - (historyCache[a].updated || 0));
    const k = keys[0];
    if (k && !activeVideoPath && findFolderForPath(k, historyCache[k].name) !== null) {
      forcePauseOnce = true;
      loadQueueFor(k, historyCache[k].name);
      inspectMediaAndPlay(historyCache[k].name, k, resumeStartTime(historyCache[k]));
    }
  } catch (e) {}
}

async function loadLibrary(refresh = false) {
  try {
    const res = await fetch(`/api/library${refresh ? '?refresh=1' : ''}`);
    const data = await res.json();
    fullLibrary = data.library || {};
    libraryRoot = data.root || '';
    await loadCustomThumbs();
    renderDashboard();
    await renderHistory();
  } catch (e) {
    /* offline: keep whatever is on screen */
  }
  restoreSessionState();
}

// Where to start when a series card is tapped: continue the most recently watched episode.
function pickSeriesStart(eps) {
  let best = null;
  eps.forEach((ep, i) => {
    const h = historyCache[ep.relPath] || historyCache[ep.fullPath];
    if (h && (!best || (h.updated || 0) > (best.h.updated || 0))) best = { i, h };
  });
  if (!best) return { ep: eps[0], time: 0 };
  if (best.h.percent >= 97) {
    const next = eps[best.i + 1];
    return { ep: next || eps[best.i], time: 0 };
  }
  return { ep: eps[best.i], time: best.h.time || 0 };
}

// Search: ignores case, accents and punctuation; every word must match, in any order (folder name plus episode name)
function normSearch(x) {
  return String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\u0080-\uffff]+/g, ' ').trim();
}

function renderDashboard(query = '') {
  seriesCardsGrid.innerHTML = '';
  const folders = Object.keys(fullLibrary);
  $('statSeriesCount').textContent = folders.length;

  let totalEps = 0;
  folders.forEach((k) => { totalEps += fullLibrary[k].length; });
  $('statEpCount').textContent = totalEps;

  const qTokens = normSearch(query).split(' ').filter(Boolean);
  const q = qTokens.join(' ');
  let shown = 0;

  folders.forEach((folder) => {
    const eps = fullLibrary[folder];
    const fN = normSearch(folder);
    const matchFolder = qTokens.every((t) => fN.includes(t));
    const matchEp = !matchFolder && eps.some((e) => { const h = fN + ' ' + normSearch(e.name); return qTokens.every((t) => h.includes(t)); });

    if (q && !matchFolder && !matchEp) return;
    shown++;

    const firstEp = eps[0];
    const sMatch = /(?:season|\bs)[\s._-]*0*(\d{1,2})\b/i.exec(folder.split(' / ').slice(-2).join(' '));
    const seriesTag = sMatch ? `S${Number(sMatch[1])}` : 'Playlist';
    const seriesDisplayName = cleanSeriesQuery(folder) || cleanMediaTitle(folder);
    const isYtFolder = /^youtube$|^downloads$|^videos$|^telegram$/i.test(seriesDisplayName);

    const watchedCount = eps.filter((e) => {
      const h = historyCache[e.relPath] || historyCache[e.fullPath];
      return h && (Number(h.percent) || 0) >= 85;
    }).length;

    const card = document.createElement('div');
    card.className = 'c1-series-card';
    card.innerHTML = `
      <div class="c1-series-thumb">
        ${isYtFolder ? `<span class="youtube-folder-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> YouTube</span>` : ''}
        <span class="c1-eps-pill">${eps.length} EPS</span>
      </div>
      <div class="c1-series-body">
        <div class="c1-series-title">${escapeHtml(seriesDisplayName)} <span>• ${escapeHtml(seriesTag)}</span></div>
        <div class="c1-series-sub">${watchedCount}/${eps.length} Watched • ${prefs.networkMode === 'online' && !isYtFolder ? 'Online Cover' : 'Local Series'}</div>
      </div>
    `;
    card.onclick = () => openSeriesPage(folder, eps, seriesDisplayName, isYtFolder);
    bindHoldVideoInfo(card, firstEp, folder);
    seriesCardsGrid.appendChild(card);
    attachThumb(card.querySelector('.c1-series-thumb'), firstEp.relPath || firstEp.fullPath, 'series', folder);
  });

  if (shown === 0) {
    const hint = document.createElement('span');
    hint.className = 'empty-hint';
    hint.textContent = q
      ? `No results for "${query}"`
      : `No videos found${libraryRoot ? ` in ${libraryRoot}` : ''}. Pick a folder in Files and tap "Set Default Root".`;
    seriesCardsGrid.appendChild(hint);
  }
}
// Put the episode's folder into the Current Series Queue before it starts playing
function loadQueueFor(key, name) {
  const folder = findFolderForPath(key, name);
  if (folder === null || !fullLibrary[folder]) return;
  currentPathTokens = folder === 'Anime Root' ? [] : folder.split(' / ');
  currentVideoList = fullLibrary[folder];
  renderInlinePlaylist();
}
function resumeStartTime(item) {
  return item.percent >= 97 ? 0 : (item.time || 0);
}

async function renderHistory() {
  try {
    const res = await fetch('/api/history');
    historyCache = await res.json();
    historyGrid.innerHTML = '';

    const keys = Object.keys(historyCache).sort((a, b) => (historyCache[b].updated || 0) - (historyCache[a].updated || 0));
    const sizeEl = $('librarySizeCount');
    if (sizeEl) sizeEl.textContent = `(${keys.length} ${keys.length === 1 ? 'item' : 'items'})`;
    const heroBg = $('heroSpotlightBg');
    const heroEpSub = $('heroEpSubTitle');
    const heroBar = $('heroSpotlightBar');
    const heroNextBtn = $('heroNextEpBtn');
    const heroNextLbl = $('heroNextEpLabel');
    const heroPreview = $('heroMiniPreview');
    const heroPrevThumb = $('heroPreviewThumb');
    const heroPrevDur = $('heroPreviewDur');
    const heroPrevCap = $('heroPreviewCap');

    lastResumeFn = null; syncFloatResume();
    if (keys.length > 0) {
      const topKey = keys[0];
      const topItem = historyCache[topKey];
      const pct = Math.min(100, Number(topItem.percent) || 0);
      const hdr = formatCardHeader(topItem.name);
      const epInfo = findCustomEpInfo(topItem.name) || '';

      heroTitle.innerHTML = hdr.tag
        ? `${escapeHtml(hdr.title)} <span style="color:var(--accent);">• ${escapeHtml(hdr.tag)}</span>`
        : escapeHtml(hdr.title);
      if (heroEpSub) heroEpSub.textContent = epInfo;
      heroProgressPill.textContent = `${formatTime(topItem.time)} / ${formatTime(topItem.dur)} (${pct}%)`;
      if (heroBar) heroBar.style.width = `${pct}%`;

      const folder = findFolderForPath(topKey, topItem.name);
      const rootBase = (libraryRoot || '').split('/').filter(Boolean).pop() || 'Storage';
      heroSynopsis.textContent = folder ? (folderLeaf(folder).replace(/\b(season|s)[\s._-]*0*\d+\b/gi, '').trim() || folderLeaf(folder)) + (/(season|\bs)[\s._-]*0*(\d{1,2})\b/i.test(folder) ? ' \u00b7 Season ' + Number(/(?:season|\bs)[\s._-]*0*(\d{1,2})\b/i.exec(folder)[1]) : '') : topKey;

      if (heroResumeLabel) heroResumeLabel.textContent = hdr.tag ? `Resume ${hdr.tag}` : 'Resume Playback';
      heroResumeBtn.onclick = () => {
        loadQueueFor(topKey, topItem.name);
        inspectMediaAndPlay(topItem.name, topKey, resumeStartTime(topItem));
        navigateTo('player');
      };
      lastResumeFn = heroResumeBtn.onclick; syncFloatResume();

      // Mini Preview Card on Right
      if (heroPreview && heroPrevThumb) {
        heroPreview.style.display = 'block';
        heroPrevThumb.style.backgroundImage = `url("/api/thumb?file=${encodeURIComponent(topKey)}&kind=video")`;
        if (heroPrevDur) heroPrevDur.textContent = formatTime(topItem.dur);
        if (heroPrevCap) heroPrevCap.textContent = epInfo || cleanMediaTitle(topItem.name);
      }

      // Hero Full-Bleed Cover Wallpaper
      if (heroBg) {
        if (prefs.networkMode === 'online' && folder) {
          fetchOnlineArtwork(folder).then((meta) => {
            if (meta && meta.found && meta.localUrl) {
              heroBg.style.backgroundImage = `url("${meta.localUrl}")`;
            } else {
              heroBg.style.backgroundImage = `url("/api/thumb?file=${encodeURIComponent(topKey)}&kind=video")`;
            }
          });
        } else {
          heroBg.style.backgroundImage = `url("/api/thumb?file=${encodeURIComponent(topKey)}&kind=video")`;
        }
      }

      // Next Episode button on Hero
      const list = folder != null ? fullLibrary[folder] : null;
      const at = list ? list.findIndex((v) => v.relPath === topKey || v.fullPath === topKey) : -1;
      if (at >= 0 && list[at + 1] && heroNextBtn) {
        const nextEp = list[at + 1];
        const nextHdr = formatCardHeader(nextEp.name);
        heroNextBtn.style.display = 'inline-flex';
        if (heroNextLbl) heroNextLbl.textContent = nextHdr.tag ? `Next Ep (${nextHdr.tag})` : 'Next Ep';
        heroNextBtn.onclick = () => {
          inspectMediaAndPlay(nextEp.name, nextEp.relPath || nextEp.fullPath, 0);
          navigateTo('player');
        };
      } else if (heroNextBtn) {
        heroNextBtn.style.display = 'none';
      }

      // Combined Up Next & Watch History Horizontal Rail (Current -> NEXT -> NEXT 2 -> NEXT 3 -> Earlier History)
      const mkCard = (name, k, subText, pctBar, onPlay, badge) => {
        const { title, tag } = formatCardHeader(name);
        const epDesc = findCustomEpInfo(name) || subText;
        const card = document.createElement('div');
        card.className = 'history-deck-card bordered-media-card' + (badge ? ' is-next' : '');
        card.innerHTML = `
          <div class="history-thumb">
            ${badge ? `<span class="hist-tag">${badge}</span>` : ''}
            ${pctBar > 0 ? `<div class="history-bar" style="width:${pctBar}%"></div>` : ''}
          </div>
          <div class="media-card-body">
            <div class="q-name"><span class="q-title">${escapeHtml(title)}</span>${tag ? `<span class="q-ep">• ${escapeHtml(tag)}</span>` : ''}</div>
            <div class="media-card-desc" style="color:#cbd5e1;font-weight:600;">${escapeHtml(epDesc)}</div>
            <div class="media-card-desc" style="margin-top:2px;">${escapeHtml(subText)}</div>
          </div>`;
        card.onclick = onPlay;
        bindHoldVideoInfo(card, { name, relPath: k, fullPath: k });
        historyGrid.appendChild(card);
        attachThumb(card.querySelector('.history-thumb'), k, 'video', name);
      };

      keys.forEach((k, idx) => {
        const item = historyCache[k];
        const itemPct = Math.min(100, Number(item.percent) || 0);
        mkCard(
          item.name,
          k,
          `${formatTime(item.time)} / ${formatTime(item.dur)} (${itemPct}%)`,
          itemPct,
          () => { inspectMediaAndPlay(item.name, k, resumeStartTime(item)); navigateTo('player'); },
          ''
        );
            });

      // Refresh watched counts on library cards
      renderDashboard(homeQuickSearch ? homeQuickSearch.value.trim() : '');
    } else {
      heroTitle.textContent = 'No active anime';
      if (heroEpSub) heroEpSub.textContent = '';
      heroProgressPill.textContent = '0%';
      if (heroBar) heroBar.style.width = '0%';
      if (heroNextBtn) heroNextBtn.style.display = 'none';
      if (heroPreview) heroPreview.style.display = 'none';
      if (heroBg) heroBg.style.backgroundImage = '';
      heroSynopsis.textContent = 'Pick an episode below to start watching.';
      if (heroResumeLabel) heroResumeLabel.textContent = 'Start Watching';
      heroResumeBtn.onclick = () => {
        const first = Object.keys(fullLibrary)[0];
        if (!first) { navigateTo('library'); return; }
        currentPathTokens = first === 'Anime Root' ? [] : first.split(' / ');
        currentVideoList = fullLibrary[first];
        const ep = currentVideoList[0];
        inspectMediaAndPlay(ep.name, ep.relPath || ep.fullPath, 0);
        navigateTo('player');
      };
      historyGrid.innerHTML = '<span class="empty-hint">No watch history yet</span>';
    }
  } catch (e) { console.error("renderHistory", e); }
}
async function clearHistory() {
  if (!(await astraConfirm('All saved watch progress will be removed.', { title: 'Clear watch history?', ok: 'Clear', danger: true }))) return;
  try {
    await fetch('/api/history/clear', { method: 'POST' });
  } catch (e) {
    showToast('Could not reach the server');
    return;
  }
  historyCache = {};
  lsRemove('astra_active_playback_state');
  renderDashboard();
  renderHistory();
  showToast('Watch history cleared', 2000);
}

const btnRescanLibrary = $('btnRescanLibrary');
if (btnRescanLibrary) {
  btnRescanLibrary.onclick = async () => {
    btnRescanLibrary.disabled = true;
    await loadLibrary(true);
    btnRescanLibrary.disabled = false;
    const eps = Object.values(fullLibrary).reduce((n, list) => n + list.length, 0);
    showToast(`Library rescanned — ${Object.keys(fullLibrary).length} series, ${eps} episodes`);
  };
}

$('resetHistoryFileBtn').onclick = clearHistory;
$('openClearHistoryModalBtn').onclick = clearHistory;

/* ------------------------------------------------------------------ */
/* Chapters                                                            */
/* ------------------------------------------------------------------ */
const chapterMarks = $('chapterMarks');
const chapterLabel = $('chapterLabel');
const chaptersBtn = $('chaptersBtn');
const chaptersPanel = $('chaptersPanel');
const chaptersList = $('chaptersList');
const skipChapterBtn = $('skipChapterBtn');
const skipChapterText = $('skipChapterText');
const SKIPPABLE = /^(op|ed|opening|ending|intro|recap|preview|credits|next episode)|opening|ending|\bop\b|\bed\b|recap|preview/i;
let chapters = [];
let chapterIdx = -1;
let autoSkipped = new Set();

function chapterAt(t) {
  for (let i = chapters.length - 1; i >= 0; i--) if (t >= chapters[i].start - 0.05) return chapters[i];
  return null;
}
function chapterTime(s) { return formatTime(s); }

function renderChapterMarks() {
  if (!chapterMarks) return;
  chapterMarks.innerHTML = '';
  const dur = getDuration();
  if (!dur) return;
  chapters.forEach((c, i) => {
    if (i === 0 || c.start <= 0 || c.start >= dur) return;
    const m = document.createElement('i');
    m.style.left = `${(c.start / dur) * 100}%`;
    chapterMarks.appendChild(m);
  });
}

function renderChapterList() {
  chaptersList.innerHTML = '';
  chapters.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'chapter-row';
    row.dataset.i = i;
    row.innerHTML = `<span class="chapter-time">${chapterTime(c.start)}</span><span class="chapter-name">${escapeHtml(c.title)}</span>`;
    row.onclick = () => { seekToTargetSecond(c.start); chaptersPanel.classList.remove('open'); resetHideTimer(); };
    chaptersList.appendChild(row);
  });
}

function setChapters(list) {
  chapters = (Array.isArray(list) ? list : []).filter((c) => Number.isFinite(c.start))
    .map((c, i) => ({ start: c.start, end: c.end, title: c.title || `Chapter ${i + 1}` }));
  chapterIdx = -2; // force refresh on next tick
  autoSkipped = new Set();
  const has = chapters.length > 0;
  if (chaptersBtn) chaptersBtn.style.display = has ? '' : 'none';
  if (chapterLabel) { chapterLabel.textContent = ''; chapterLabel.style.display = 'none'; }
  if (typeof syncSkipOrNextEpButton === 'function') syncSkipOrNextEpButton(false, false);
  if (chaptersPanel) chaptersPanel.classList.remove('open');
  renderChapterMarks();
  renderChapterList();
}

function syncSkipOrNextEpButton(hasNextChapter, skippable) {
  if (!skipChapterBtn) return;
  const activeIdx = currentVideoList.findIndex(isActiveItem);
  const hasNextEp = activeIdx >= 0 && activeIdx < currentVideoList.length - 1;

  if (hasNextChapter) {
    skipChapterBtn.style.display = 'inline-flex';
    skipChapterText.textContent = 'NEXT CHAPTER';
    skipChapterBtn.dataset.mode = 'chapter';
    skipChapterBtn.classList.remove('next-ep-mode');
    skipChapterBtn.classList.toggle('highlight', !!skippable);
  } else if (hasNextEp) {
    skipChapterBtn.style.display = 'inline-flex';
    skipChapterText.textContent = 'NEXT EPISODE';
    skipChapterBtn.dataset.mode = 'episode';
    skipChapterBtn.classList.remove('highlight');
    skipChapterBtn.classList.add('next-ep-mode');
  } else {
    skipChapterBtn.style.display = 'none';
    skipChapterBtn.dataset.mode = '';
  }
}

function onChapterTick(t) {
  if (!chapters.length) {
    syncSkipOrNextEpButton(false, false);
    return;
  }
  const cur = chapterAt(t);
  const idx = cur ? chapters.indexOf(cur) : -1;
  if (idx === chapterIdx) return;
  chapterIdx = idx;
  if (chapterLabel) { chapterLabel.textContent = cur ? cur.title : ''; chapterLabel.style.display = cur ? 'inline-flex' : 'none'; }
  chaptersList.querySelectorAll('.chapter-row').forEach((r) => r.classList.toggle('current', Number(r.dataset.i) === idx));
  const hasNext = idx >= 0 && idx < chapters.length - 1;
  const skippable = cur && SKIPPABLE.test(cur.title);
  syncSkipOrNextEpButton(hasNext, skippable);
  if (prefs.autoSkip && skippable && hasNext && !autoSkipped.has(idx) && cur.end - t > 2) {
    autoSkipped.add(idx);
    showToast(`Skipped ${cur.title}`, 1500);
    seekToTargetSecond(cur.end + 0.05);
  }
}

function stepChapter(dir) {
  if (isScreenLocked || !chapters.length) return;
  const t = absoluteTime();
  const cur = chapterAt(t);
  let idx = cur ? chapters.indexOf(cur) : 0;
  if (dir < 0) idx = (t - chapters[idx].start > 3) ? idx : idx - 1;
  else idx += 1;
  if (idx < 0) idx = 0;
  if (idx >= chapters.length) return;
  seekToTargetSecond(chapters[idx].start);
  showToast(chapters[idx].title, 1200);
}
function toggleChaptersPanel() {
  if (!chapters.length || isScreenLocked) return;
  playerEpisodesDrawer.classList.remove('open');
  settingsModal.classList.remove('open');
  chaptersPanel.classList.toggle('open');
  const cur = chaptersList.querySelector('.chapter-row.current');
  if (cur) cur.scrollIntoView({ block: 'center' });
}
if (chaptersBtn) chaptersBtn.onclick = (e) => { e.stopPropagation(); toggleChaptersPanel(); };
$('chaptersClose').onclick = () => chaptersPanel.classList.remove('open');
if (skipChapterBtn) skipChapterBtn.onclick = async (e) => {
  e.stopPropagation();
  if (skipChapterBtn.dataset.mode === 'episode') {
    const oldPath = activeVideoPath;
    const oldTitle = playerCurrentTitle.textContent;
    const oldDur = getDuration() || 100;
    if (oldPath) {
      await syncHistoryToServer(oldPath, oldTitle, oldDur, oldDur);
    }
    playAdjacentEpisode(1);
    return;
  }
  stepChapter(1);
};
video.addEventListener('durationchange', renderChapterMarks);
video.addEventListener('loadedmetadata', renderChapterMarks);

/* ------------------------------------------------------------------ */
/* Transcode pre-buffer / rebuffer                                     */
/* ------------------------------------------------------------------ */
let rebufferTimer = null;
function bufferedAhead() {
  const t = video.currentTime;
  for (let i = 0; i < video.buffered.length; i++) {
    if (video.buffered.start(i) <= t + 0.3 && video.buffered.end(i) >= t) return video.buffered.end(i) - t;
  }
  return 0;
}
function endRebuffer(resume = true) {
  clearInterval(rebufferTimer); rebufferTimer = null;
  if (!internalPause) return;
  internalPause = false;
  playerBufferingIndicator.classList.remove('show');
  if (resume) video.play().catch(() => {});
}
function startRebuffer() {
  if (internalPause) return;
  internalPause = true;
  const token = playToken;
  const began = Date.now();
  let best = 0, lastGain = Date.now();
  video.pause();
  playerBufferingIndicator.classList.add('show');
  rebufferTimer = setInterval(() => {
    if (token !== playToken || !isTranscodingMode) { endRebuffer(false); return; }
    const dur = getDuration() || 0;
    const remaining = dur ? Math.max(0, dur - absoluteTime()) : 999;
    const target = Math.min(needBuf(), remaining - 1);
    const ahead = bufferedAhead();
    probeLoadingText.textContent = `Buffering ${Math.floor(ahead)}s / ${Math.floor(target)}s`;
    if (ahead > best + 0.3) { best = ahead; lastGain = Date.now(); }
    // stop waiting when the encoder is not producing anything new (slow phone), instead of staring at 0s
    if (ahead >= target || Date.now() - began > 30000 || (Date.now() - lastGain > 8000 && Date.now() - began > 8000)) endRebuffer(true);
  }, 400);
}
// A manual play/pause press during a rebuffer simply ends the wait.
const _togglePlayPause = togglePlayPause;
togglePlayPause = function () {
  if (internalPause) {                 // honour-pause-while-buffering: the user pressed pause while we were buffering
    endRebuffer(false);
    updatePlayButtonIcon(false);
    notifyStreamPause();
    resetHideTimer();
    return;
  }
  _togglePlayPause();
};

/* Auto resolution: watch the transcoder speed, step down when it cannot keep up */
let autoSlowHits = 0, autoLastStep = 0;
setInterval(async () => {
  if (prefs.quality !== 'auto' || qualityOverride || !isTranscodingMode || !isCurrentFile10Bit || video.paused || internalPause || document.hidden) { autoSlowHits = 0; return; }
  if (autoLevel >= AUTO_LEVELS.length - 1 || Date.now() - autoLastStep < 15000) return;
  try {
    const st = await (await fetch('/api/transcode/stats')).json();
    if (!st.active || !st.speed || st.age > 4000) return;
    const starving = bufferedAhead() < 4;
    autoSlowHits = (st.speed < 0.95 && starving) ? autoSlowHits + 1 : 0;
    if (autoSlowHits >= 2) {
      autoSlowHits = 0; autoLastStep = Date.now(); autoLevel++;
      const h = { balanced: 720, fast: 480, low: 360 }[AUTO_LEVELS[autoLevel]];
      showToast(`Decoder at ${st.speed.toFixed(2)}x \u2192 switching to ${h}p`, 3000);
      seekToTargetSecond(absoluteTime(), true, true);   // auto-step-restart
    }
  } catch (e) {}
}, 2500);


/* ===== v1.26.1 Online Original Covers, Task Reporting & Ambient Background ===== */
const onlineMetaCache = new Map();

/* The name of a series is the folder that holds the videos ("Anime / Darling in the Franxx S01" -> "Darling in the Franxx"),
   never the folder the scan started from. A pure season folder ("Season 2") uses its parent's name. */
function folderLeaf(raw) {
  const toks = String(raw || "").split("/").map((t) => t.trim()).filter(Boolean);
  if (!toks.length) return "";
  let i = toks.length - 1;
  while (i > 0 && /^(season|s)[\s._-]*0*\d+$|^specials?$/i.test(toks[i].replace(/[._]/g, " ").trim())) i--;
  return toks[i].replace(/^\.+/, "");
}
function cleanSeriesQuery(raw) {
  const part = folderLeaf(raw);
  const noSeason = part.replace(/\b(season|s)[\s._-]*0*\d+\b/gi, "").trim();
  return parseMedia(noSeason || part).title || noSeason || part;
}
const curSeriesName = () => cleanSeriesQuery(currentPathTokens.join(" / ")) || "";

async function fetchOnlineArtwork(rawTitle) {
  if (prefs.networkMode !== "online" || !rawTitle) return null;
  const title = cleanSeriesQuery(rawTitle);
  const q = prefs.thumbQuality || "360p";
  const key = `${title.toLowerCase()}|${q}`;
  if (onlineMetaCache.has(key)) return onlineMetaCache.get(key);
  try {
    const res = await fetch(`/api/meta/online?title=${encodeURIComponent(title)}&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    onlineMetaCache.set(key, data && data.found ? data : null);
    return onlineMetaCache.get(key);
  } catch (e) {
    showToast("Online cover fetch failed (check internet)", 3000);
    return null;
  }
}

// The page background always keeps its original color (the blurred cover backdrop was removed).
function applyAmbientBackground() {
  const bg = $("astraAmbientBg"); if (bg) { bg.style.backgroundImage = ""; bg.classList.remove("active"); }
  const hero = $("heroBanner"); if (hero) hero.style.backgroundImage = "";
  const pw = $("playerWrapper"); if (pw) pw.style.boxShadow = "";
}

async function syncOnlineArtworkForActive() {
  if (prefs.networkMode !== "online" || !activeVideoPath) {
    applyAmbientBackground("");
    return;
  }
  const seriesName = curSeriesName() || activeVideoPath.split("/").pop() || "";
  const meta = await fetchOnlineArtwork(seriesName);
  if (meta && meta.found && meta.localUrl) {
    applyAmbientBackground(meta.localUrl);
  } else {
    applyAmbientBackground("");
  }
}

/* ------------------------------------------------------------------ */
/* Thumbnails (lazy, 2 at a time, cached in memory + server disk)      */
/* ------------------------------------------------------------------ */
const thumbCache = new Map();
const thumbQueue = [];
let thumbActive = 0;
const thumbObserver = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    thumbObserver.unobserve(en.target);
    const job = en.target._thumbJob;
    if (job) { thumbQueue.push(job); pumpThumbs(); }
  });
}, { rootMargin: '200px' }) : null;

function pumpThumbs() {
  while (thumbActive < 3 && thumbQueue.length) {
    const job = thumbQueue.pop();   // newest first: what is on screen now loads before what was scrolled past
    thumbActive++;
    loadThumb(job).finally(() => { thumbActive--; pumpThumbs(); });
  }
}
function setThumbFallback(el) {
  if (!el) return;
  el.style.backgroundImage = '';
  el.classList.remove('has-img');
  el.classList.add('thumb-fallback');
}
function setThumbImage(el, url) {
  if (!el || !url) return false;
  const probe = new Image();
  probe.onload = () => {
    if (!el.isConnected) return;
    el.style.backgroundImage = `url("${url}")`;
    el.classList.add('has-img');
    el.classList.remove('thumb-fallback');
  };
  probe.onerror = () => setThumbFallback(el);
  probe.src = url;
  return true;
}
async function loadThumb(job) {
  const { el, file, kind } = job;
  if (!el.isConnected) return;
  const key = `${kind}:${file}`;
  let url = thumbCache.get(key);
  if (!url) {
    try {
      const res = await fetch(`/api/thumb?file=${encodeURIComponent(file)}&kind=${kind}${prefs.networkMode === 'online' ? '&online=1' : ''}`);
      if (res.status === 200) {
        url = URL.createObjectURL(await res.blob());
        thumbCache.set(key, url);
      } else if (res.status === 204 && (job.tries = (job.tries || 0) + 1) <= 3) {
        setTimeout(() => { if (el.isConnected) { thumbQueue.push(job); pumpThumbs(); } }, 20000);
        return;
      } else {
        setThumbFallback(el);
      }
    } catch (e) { setThumbFallback(el); return; }
  }
  if (url && el.isConnected) setThumbImage(el, url);
  else if (el.isConnected && !job.tries) setThumbFallback(el);
}
let customThumbKeys = new Set(), customThumbStamp = Date.now();
function loadCustomThumbs() {
  return fetch('/api/thumbs/custom').then((r) => r.json()).then((d) => { customThumbKeys = new Set(d.keys || []); customThumbStamp = Date.now(); }).catch(() => {});
}
/* Themed text covers (offline / no artwork): tinted card + coloured title */
const COVER_HUES = [
  [/code[\s._-]*geass/i, 214],   // Code Geass -> theme blue
  [/eminence/i, 214],
  [/darling|franxx/i, 330],
  [/youtube|downloads|videos|telegram/i, 2]
];
function coverHue(text) {
  for (const [re, h] of COVER_HUES) if (re.test(text)) return h;
  let n = 0;
  for (let i = 0; i < text.length; i++) n = (n * 31 + text.charCodeAt(i)) % 360;
  return n;
}
function applyTextCover(el, text, hueSource) {
  const t = (text || '').trim() || '▶';
  el.classList.remove('has-img');
  el.style.backgroundImage = '';
  el.style.setProperty('--cv-h', coverHue(hueSource || t));
  el.dataset.cover = t;
  el.classList.add('text-cover');
}

function attachThumb(el, file, kind, label) {
  if (!el) return;
  el.dataset.initial = (cleanMediaTitle(label || '').trim()[0] || '▶').toUpperCase();
  if (!prefs.thumbs || !file) return;
  const isCoverEl = el.classList.contains('c1-series-thumb') || el.classList.contains('history-thumb');
  if (isCoverEl && !(kind === 'series' && label && customThumbKeys.has(label))) {
    const useOnline = prefs.networkMode === 'online' && kind === 'series' && label;
    const textFor = () => {
      if (kind === 'series') return cleanSeriesQuery(label) || cleanMediaTitle(label);
      const h = formatCardHeader(label || '');
      return h.tag || h.title;
    };
    const cover = () => applyTextCover(el, textFor(), kind === 'series' ? label : (formatCardHeader(label || '').title));
    if (!useOnline) { cover(); return; }
    cover();   // show the cover immediately, swap to real artwork if found
    fetchOnlineArtwork(label).then((meta) => {
      if (meta && meta.found && meta.localUrl && el.isConnected) {
        el.classList.remove('text-cover');
        el.style.backgroundImage = `url("${meta.localUrl}")`;
        el.classList.add('has-img');
      }
    });
    return;
  }
  if (kind === "series" && label && customThumbKeys.has(label)) {
    // custom thumbnail from config.json always wins
    const u = "/api/thumb/custom?key=" + encodeURIComponent(label) + "&v=" + customThumbStamp;
    el.style.backgroundImage = `url("${u}")`; el.classList.add("has-img");
    return;
  }
  if (prefs.networkMode === "online" && kind === "series" && label) {
    const seriesHint = label;
    fetchOnlineArtwork(seriesHint).then((meta) => {
      if (meta && meta.found && meta.localUrl && el.isConnected) {
        el.style.backgroundImage = `url("${meta.localUrl}")`;
        el.classList.add("has-img");
        return;
      }
      el._thumbJob = { el, file, kind };
      if (thumbObserver) thumbObserver.observe(el);
      else { thumbQueue.push(el._thumbJob); pumpThumbs(); }
    });
    return;
  }
  el._thumbJob = { el, file, kind };
  if (thumbObserver) thumbObserver.observe(el);
  else { thumbQueue.push(el._thumbJob); pumpThumbs(); }
}

/* ------------------------------------------------------------------ */
/* Sleep timer & preferences panel                                     */
/* ------------------------------------------------------------------ */
let sleepEndAt = 0, sleepTick = null;
function paintSleep() {
  const left = $('sleepLeft'), txt = $('sleepText'), sel = $('prefSleep');
  let s = 'Off', val = '0';
  if (sleepAtEnd) { s = 'Stops after this episode'; val = '-1'; }
  else if (sleepEndAt) {
    const rem = Math.max(0, Math.round((sleepEndAt - Date.now()) / 1000));
    s = `Pauses in ${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}`; val = String(sleepMin);
  }
  if (left) left.textContent = sleepAtEnd ? 'End of episode' : (sleepEndAt ? s.replace('Pauses in ', '') : 'Off');
  if (txt) txt.textContent = s;
  if (sel && [...sel.options].some((o) => o.value === val)) sel.value = val;
  document.querySelectorAll('#sleepChips [data-sleep]').forEach((b) => b.classList.toggle('active', b.dataset.sleep === val));
}
let sleepMin = 0;
function setSleep(min) {
  clearTimeout(sleepTimerId); sleepTimerId = null; sleepAtEnd = false; sleepEndAt = 0; sleepMin = 0;
  clearInterval(sleepTick); sleepTick = null;
  if (min > 0) {
    sleepMin = min; sleepEndAt = Date.now() + min * 60000;
    sleepTimerId = setTimeout(() => {
      video.pause(); notifyStreamPause();
      showToast('Sleep timer: paused', 4000);
      sleepEndAt = 0; sleepMin = 0; clearInterval(sleepTick); paintSleep();
    }, min * 60000);
    sleepTick = setInterval(paintSleep, 1000);
  } else if (min < 0) sleepAtEnd = true;
  paintSleep();
}
document.querySelectorAll('#sleepChips [data-sleep]').forEach((b) => b.addEventListener('click', () => { setSleep(Number(b.dataset.sleep)); if (b.dataset.sleep !== '0') showToast(b.dataset.sleep === '-1' ? 'Will stop after this episode' : `Will pause in ${b.dataset.sleep} min`, 1800); }));

// Screen fit: Fit = whole picture, Fill = crop edges, Auto = fill only when that crops about 15% or less (video almost as wide as the screen)
function fitMode() { return prefs.fit || (prefs.fsFill ? 'fill' : 'fit'); }
function shouldFill() {
  const m = fitMode();
  if (m === 'fill') return true;
  if (m !== 'auto') return false;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh || !window.innerWidth || !window.innerHeight) return false;
  const va = vw / vh, sa = window.innerWidth / window.innerHeight;
  return Math.max(va, sa) / Math.min(va, sa) <= 1.15;
}
function applyFill() {
  const fill = shouldFill();
  playerWrapper.classList.toggle('fit-fill', fill);
  try { if (window.AstraNative && AstraNative.fit) AstraNative.fit(fill && document.documentElement.classList.contains('player-locked')); } catch (e) {}
}
video.addEventListener('loadedmetadata', applyFill);
video.addEventListener('resize', applyFill);
window.addEventListener('resize', applyFill);
document.addEventListener('fullscreenchange', applyFill);
function initPrefsPanel() {
  const bind = (id, key, num) => {
    const el = $(id); if (!el) return;
    if (el.type === 'checkbox') { el.checked = !!prefs[key]; el.onchange = () => { prefs[key] = el.checked; savePrefs(); }; }
    else { el.value = String(prefs[key]); el.onchange = () => { prefs[key] = num ? Number(el.value) : el.value; savePrefs(); }; }
  };
  bind('prefSeek', 'seekStep', true);
  bind('prefNetworkMode', 'networkMode');
  const syncNetUi = () => {
    const r = $("rowThumbQuality");
    if (r) r.style.display = prefs.networkMode === "online" ? "" : "none";
  };
  syncNetUi();
  bind('prefThumbQuality', 'thumbQuality');
  const tqSel = $("prefThumbQuality");
  if (tqSel) tqSel.addEventListener("change", () => {
    onlineMetaCache.clear();
    renderDashboard();
    renderHistory();
    if (activeVideoPath) syncOnlineArtworkForActive();
    showToast(`Online thumbnail quality: ${prefs.thumbQuality}`, 1800);
  });
  const netSel = $("prefNetworkMode");
  if (netSel) netSel.addEventListener("change", () => {
    syncNetUi();
    onlineMetaCache.clear();
    applyAmbientBackground("");
    renderDashboard();
    renderHistory();
    if (activeVideoPath) syncOnlineArtworkForActive();
    showToast(prefs.networkMode === "online" ? "Online mode: fetching original thumbnails & backgrounds" : "Offline mode: local media only", 2400);
  }); bind('prefQuality', 'quality'); bind('prefAutoPlay', 'autoPlay'); bind('prefLite', 'lite');
  bind('prefAutoSkip', 'autoSkip'); bind('prefFsRotate', 'fsRotate'); bind('prefAutoNext', 'autoNext');
  bind('prefHw', 'hwEnc');
  bind('prefPerf', 'perf');
  { const pp = () => { try { if (window.AstraNative && AstraNative.perf) AstraNative.perf(prefs.perf || 'fast'); } catch (e) {} }; pp(); const el = $('prefPerf'); if (el) el.addEventListener('change', pp); }
  bind('prefFloatResume', 'floatResume'); bind('prefListChips', 'listChips'); bind('prefNewDays', 'newDays', true); bind('prefDecoder', 'decoder');
  { const frb = $('floatResume'); if (frb) frb.onclick = () => { if (typeof lastResumeFn === 'function') lastResumeFn(); }; }
  const pushDecoder = () => { try { if (window.AstraNative && AstraNative.decoder) AstraNative.decoder(prefs.decoder || 'auto'); } catch (e) {} };
  pushDecoder(); { const d = $('prefDecoder'); if (d) d.addEventListener('change', pushDecoder); }
  ['prefFloatResume', 'prefListChips', 'prefNewDays'].forEach((id) => { const el = $(id); if (el) el.addEventListener('change', () => { syncFloatResume(); try { if (typeof renderFloatingEpisodes === 'function') renderFloatingEpisodes(); } catch (e) {} }); });
  /* settings sections */
  const setView = $('view-settings');
  const SEC_TITLE = { general: 'General', player: 'Player', storage: 'Storage', custom: 'Customize', subs: 'Subtitles', stats: 'Watch stats', about: 'App info' };
  const showSec = (sec) => {
    setView.dataset.sec = sec;
    $('setTitle').textContent = SEC_TITLE[sec] || '';
    window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent('astra-sec', { detail: sec }));
    if (sec === 'about') loadAbout();
    if (sec === 'stats') renderStats();
  };
  window.astraSetSec = showSec;
  document.querySelectorAll('#setHome .set-row').forEach((b) => { b.onclick = () => showSec(b.dataset.sec); });
  $('setBack').onclick = () => showSec('home');
  /* customize: hide buttons you do not use */
  const UI_CLASS = { uiNav: 'ui-no-nav', uiChapter: 'ui-no-chapter', uiCast: 'ui-no-cast', uiLock: 'ui-no-lock', uiQuality: 'ui-no-quality' };
  const applyUi = () => Object.keys(UI_CLASS).forEach((k) => document.documentElement.classList.toggle(UI_CLASS[k], prefs[k] === false));
  [['prefUiNav', 'uiNav'], ['prefUiChapter', 'uiChapter'], ['prefUiCast', 'uiCast'], ['prefUiLock', 'uiLock'], ['prefUiQuality', 'uiQuality']].forEach(([id, k]) => {
    const el = $(id); if (!el) return;
    el.checked = prefs[k] !== false;
    el.onchange = () => { prefs[k] = el.checked; savePrefs(); applyUi(); };
  });
  applyUi();
  /* UI size (app only) */
  const sizeRow = $('uiSizeRow');
  if (sizeRow) {
    if (!window.AstraNative) { sizeRow.style.display = 'none'; $('uiSizeChips').style.display = 'none'; }
    else {
      const cur = () => { try { return AstraNative.getUiScale() | 0 || 100; } catch (e) { return 100; } };
      const paint = () => { const p = cur(); $('uiSizeVal').textContent = p + '%'; document.querySelectorAll('#uiSizeChips button').forEach((b) => b.classList.toggle('on', +b.dataset.p === p)); };
      const set = (p) => { p = Math.max(50, Math.min(130, p)); try { AstraNative.uiScale(p); } catch (e) {} setTimeout(() => { paint(); window.dispatchEvent(new Event('resize')); }, 150); };
      $('uiSizeChips').innerHTML = [60, 70, 80, 90, 100, 110, 120].map((p) => `<button type="button" class="pill-btn" data-p="${p}">${p}%</button>`).join('');
      $('uiSizeChips').onclick = (e) => { const b = e.target.closest('button'); if (b) set(+b.dataset.p); };
      sizeRow.querySelectorAll('button[data-d]').forEach((b) => { b.onclick = () => set(cur() + (+b.dataset.d)); });
      paint();
    }
  }
  if (window.AstraNative) document.documentElement.classList.add('astra-app');
  if (!prefs.fit) prefs.fit = prefs.fsFill ? 'fill' : 'fit'; bind('prefFit', 'fit'); { const pf = $('prefFit'); if (pf) { pf.value = fitMode(); pf.addEventListener('change', () => { prefs.fsFill = prefs.fit === 'fill'; savePrefs(); applyFill(); }); } } applyFill();
  const th = $('prefThumbs');
  if (th) { th.checked = !!prefs.thumbs; th.onchange = () => { prefs.thumbs = th.checked; savePrefs(); renderDashboard(); renderHistory(); }; }
  $('prefSleep').onchange = (e) => setSleep(Number(e.target.value));
  $('prefQuality').addEventListener('change', () => {
    if (isTranscodingMode && activeVideoPath) { showToast('Applying quality...', 1500); seekToTargetSecond(absoluteTime(), true, true); /* quality-restart */ }
  });
  const fmtBytes = (n) => n >= 1073741824 ? (n / 1073741824).toFixed(2) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';
  const refreshCacheInfo = async () => {
    if (!$('cacheThumbSize')) return;
    try {
      const r = await fetch('/api/cache/info'); if (!r.ok) return; const c = await r.json();
      $('cacheThumbSize').textContent = fmtBytes(c.thumbs.bytes) + ' • ' + c.thumbs.files + ' files';
      $('cacheConvSize').textContent = fmtBytes(c.converted.bytes) + ' • ' + c.converted.files + ' files';
      $('cacheTotalSize').textContent = fmtBytes(c.total) + ' in total';
    } catch (e) {}
  };
  const clearCache = async (what) => {
    try { const r = await fetch('/api/cache/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ what }) }); if (!r.ok) throw 0; }
    catch (e) { showToast('Could not clear the cache', 2500, 'err'); return; }
    if (what !== 'converted') { thumbCache.forEach((u) => URL.revokeObjectURL(u)); thumbCache.clear(); renderDashboard(); renderHistory(); }
    showToast(what === 'thumbs' ? 'Thumbnails cleared' : what === 'converted' ? 'Converted videos cleared' : 'Cache cleared', 2000, 'ok');
    refreshCacheInfo();
  };
  $('btnClearThumbs').onclick = () => clearCache('thumbs');
  $('btnClearConv').onclick = async () => { if (await astraConfirm('Delete all converted videos? Anything being converted right now will stop.')) clearCache('converted'); };
  $('btnClearAllCache').onclick = async () => { if (await astraConfirm('Clear thumbnails and converted videos?')) clearCache('all'); };
  refreshCacheInfo();
  document.querySelectorAll('[data-target]').forEach((b) => b.addEventListener('click', () => setTimeout(refreshCacheInfo, 50)));
  setInterval(() => { if ($('cacheThumbSize') && $('cacheThumbSize').offsetParent) refreshCacheInfo(); }, 5000);

  /* backup & restore */
  const bkJson = async () => {
    const [h, p, sb] = await Promise.all([fetch('/api/history').then((r) => r.json()), fetch('/api/profile').then((r) => r.json()), fetch('/api/backup/subs').then((r) => r.ok ? r.json() : {}).catch(() => ({}))]);
    return JSON.stringify({ app: 'astra-player', version: 2, at: new Date().toISOString(), history: h, profile: p.keys || {}, watch: wlogGet(), subs: sb });
  };
  const bkStamp = () => { const d = new Date(); const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}`; };
  async function doBackup(silent) {
    try {
      const json = await bkJson();
      const fname = 'astra-backup-' + bkStamp() + '.json';
      if (window.astraNativeSave) {
        const where = window.astraNativeSave(fname, json, appFolder('backup'));
        if (!silent) showToast(where ? 'Backup saved: ' + where : 'Could not save the backup', 3500, where ? 'ok' : 'err');
        if (where) { try { localStorage.setItem('astra_last_backup', String(Date.now())); } catch (e) {} await pruneBackups(); }
        refreshBackups(); return !!where;
      }
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      if (!silent) showToast('Backup saved', 2000, 'ok');
      return true;
    } catch (e) { if (!silent) showToast('Backup failed', 2500, 'err'); return false; }
  }
  async function pruneBackups() {
    try {
      const d = await fetch('/api/downloads/list?folder=' + encodeURIComponent(appFolder('backup'))).then((r) => r.json());
      const old = (d.files || []).filter((f) => /^astra-backup-/.test(f.name)).slice(5);
      for (const f of old) await fetch('/api/downloads/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: appFolder('backup'), name: f.name }) });
    } catch (e) {}
  }
  async function refreshBackups() {
    const box = $('bkList'); if (!box) return;
    try {
      const d = await fetch('/api/downloads/list?folder=' + encodeURIComponent(appFolder('backup'))).then((r) => r.json());
      const files = (d.files || []).filter((f) => /\.json$/i.test(f.name));
      box.innerHTML = files.length ? files.slice(0, 5).map((f) => `<div class="bk-row"><div><b>${escapeHtml(f.name.replace(/^astra-backup-|\.json$/g, '').replace('_', ' '))}</b><small>${(f.bytes / 1024).toFixed(0)} KB</small></div><button class="pill-btn sm" data-bk="${escapeHtml(f.name)}">Restore</button></div>`).join('') : '';
      box.querySelectorAll('[data-bk]').forEach((b) => { b.onclick = async () => {
        try { const t = await fetch('/api/downloads/get?folder=' + encodeURIComponent(appFolder('backup')) + '&name=' + encodeURIComponent(b.dataset.bk)).then((r) => r.text()); await restoreFrom(JSON.parse(t)); } catch (e) { showToast('Could not read that backup', 3000, 'err'); }
      }; });
    } catch (e) { box.innerHTML = ''; }
  }
  async function restoreFrom(d) {
    if (!d || d.app !== 'astra-player') return showToast('That is not an Astra backup', 3000, 'err');
    const n = Object.keys(d.history || {}).length;
    if (!(await astraConfirm('Restore ' + n + ' history entries, your settings and subtitles? Newer local history is kept.'))) return;
    try {
      if (d.watch) { const cur = wlogGet(); Object.keys(d.watch).forEach((k) => { cur[k] = Math.max(cur[k] || 0, d.watch[k] || 0); }); localStorage.setItem(WLOG_KEY, JSON.stringify(cur)); }
      const r = await fetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: d.history, profile: d.profile, subs: d.subs, mode: 'merge' }) });
      if (!r.ok) throw 0; const j = await r.json();
      showToast('Restored ' + j.history + ' history entries' + (j.subs ? ' and ' + j.subs + ' subtitles' : '') + '. Reloading...', 2500, 'ok');
      setTimeout(() => location.reload(), 1500);
    } catch (err) { showToast('Restore failed', 3000, 'err'); }
  }
  $('btnBackup').onclick = () => doBackup(false);
  $('btnRestore').onclick = () => $('restoreFile').click();
  $('restoreFile').onchange = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    let d; try { d = JSON.parse(await f.text()); } catch (err) { return showToast('That is not a valid backup file', 3000, 'err'); }
    restoreFrom(d);
  };
  /* import watch history (MX Player database copy, json, csv) */
  $('btnImport').onclick = () => $('importFile').click();
  $('importFile').onchange = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return showToast('That file is too big (max 25 MB)', 3000, 'err');
    try {
      const buf = new Uint8Array(await f.arrayBuffer()); let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      const r = await fetch('/api/import/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.name, data: btoa(bin) }) });
      const j = await r.json();
      if (!j.ok) return showToast(j.error || 'Could not import that file', 3500, 'err');
      showToast(j.imported ? `Imported ${j.imported} of ${j.scanned} entries` : (j.scanned ? 'Nothing new to import' : 'No watch positions found in that file'), 3500, j.imported ? 'ok' : '');
      if (j.imported) { await renderHistory(); renderDashboard(); }
    } catch (err) { showToast('Import failed', 3000, 'err'); }
  };
  { const ab = $('prefAutoBackup'); if (ab) { ab.checked = localStorage.getItem('astra_auto_backup') === '1'; ab.onchange = () => { try { localStorage.setItem('astra_auto_backup', ab.checked ? '1' : '0'); } catch (e) {} }; } }
  refreshBackups();
  setTimeout(() => { try { if (localStorage.getItem('astra_auto_backup') === '1' && window.astraNativeSave && Date.now() - Number(localStorage.getItem('astra_last_backup') || 0) > 7 * 864e5) doBackup(true); } catch (e) {} }, 20000);
  fetch('/api/system/capabilities').then((r) => r.json()).then((c) => {
    $('prefHwText').textContent = prefs.hwEnc === 'auto' && c.hwEncoder
      ? `HEVC → H.264: hardware encoder (${c.hwEncoder}) first, software fallback`
      : 'HEVC → H.264: software x264 (v1.3 engine)';
  }).catch(() => {});
}
initPrefsPanel();

/* ------------------------------------------------------------------ */
/* AI subtitles (whisper.cpp on the server, fully offline)             */
/* ------------------------------------------------------------------ */
const aiUi = {
  box: $('aiBox'), state: $('aiState'), bar: $('aiBar'), prog: $('aiProgress'), hint: $('aiHint'), chip: $('aiChip'),
  gen: $('aiGenBtn'), all: $('aiGenAllBtn'), cancel: $('aiCancelBtn'), lang: $('aiLang'), tr: $('aiTranslate'), songs: $('aiSongs'), online: $('aiOnline'), files: $('aiFiles')
};
let aiMode = 'ai', aiLocal = true;
const AI_ONLINE_SAVE = 'astra_ai_online';
let aiVad = true;
const AI_MODE_TEXT = {
  quick: 'Quick: smallest model, only the speech is read. Fast, but it can mishear or miss words.',
  ai: 'AI: a better model. Slower, but much more accurate. Best for dialogue you really want to follow.'
};
function setAiMode(m, save) {
  aiMode = m === 'ai' ? 'ai' : 'quick';
  document.querySelectorAll('[data-aimode]').forEach((b) => b.classList.toggle('active', b.dataset.aimode === aiMode));
  if (aiUi.hint) aiUi.hint.textContent = AI_MODE_TEXT[aiMode] + (aiVad ? '' : ' Install the speech-detection model for a big speed-up (README).');
  if (save && activeVideoPath) { aiRowKey = null; aiCheck(activeVideoPath, false); }
  if (save) saveCurrentSettings();
}
document.querySelectorAll('[data-aimode]').forEach((b) => { b.onclick = () => setAiMode(b.dataset.aimode, true); });
let aiAvailable = false;
let aiPoll = null;
let aiActiveKey = null;
let aiRowKey = null;
let aiLastCues = -1;

function aiQuery(file) {
  return `file=${encodeURIComponent(file)}&audioTrack=${encodeURIComponent(activeAudioStreamIndex)}`
    + `&lang=${aiUi.lang.value}&translate=${aiUi.tr.checked ? 1 : 0}&mode=${aiMode}&songs=${aiUi.songs.checked ? 1 : 0}${aiUi.online.checked ? '&online=1' : ''}${curEngineKey() ? '&engine=' + curEngineKey() : ''}`;
}
const aiMeta = document.createElement('div'); aiMeta.className = 'ai-meta';
const aiLive = document.createElement('div'); aiLive.className = 'ai-live';
const aiErr = document.createElement('div'); aiErr.className = 'ai-err';
aiUi.prog.after(aiMeta, aiLive, aiErr);
const fmtDur = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), r = sec % 60; return m ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`; };
function aiShow(info) {
  const active = info && ['queued', 'extracting', 'transcribing'].includes(info.state);
  aiUi.prog.classList.toggle('on', !!active || (info && info.state === 'done'));
  aiUi.bar.style.width = `${info ? info.pct || 0 : 0}%`;
  aiUi.cancel.style.display = active ? '' : 'none';
  aiUi.gen.disabled = !aiAvailable || !!active;
  aiUi.all.disabled = !aiAvailable;
  let txt = '';
  if (info) {
    if (info.state === 'queued') txt = `Waiting${info.queued ? ` (${info.queued} in queue)` : ''}`;
    else if (info.state === 'transcribing') txt = `${info.pct}%`;
    else if (info.state === 'done') txt = 'Ready';
    else if (info.state === 'error') txt = 'Failed';
    else if (info.state === 'cancelled') txt = 'Cancelled';
  }
  aiUi.state.textContent = txt;
  aiMeta.textContent = '';
  if (info && info.state === 'transcribing') {
    const left = info.eta != null ? ` · ~${fmtDur(info.eta)} left` : '';
    aiMeta.innerHTML = `<span>${info.mode === 'quick' ? 'Quick' : 'AI'} \u00b7 part ${info.chunk} of ${info.chunks}${left}</span><span>${fmtDur(info.elapsed)} elapsed${info.queued ? ` · ${info.queued} queued` : ''}</span>`;
  }
  aiLive.textContent = info && info.state === 'transcribing' && info.last ? `\u201c${info.last}\u201d` : '';
  aiErr.textContent = info && info.state === 'error' ? (info.msg || 'Subtitle generation failed') : '';
  aiUi.chip.style.display = active ? '' : 'none';
  if (active) aiUi.chip.textContent = `Subs ${Math.round(info.pct)}%`;
  aiUi.files.textContent = '';
  if (info && info.state === 'done' && info.key) {
    const nm = document.createElement('div'); nm.className = 'ai-file-name'; nm.textContent = info.name || 'Subtitles';
    const row = document.createElement('div'); row.className = 'ai-file-links';
    ['srt', 'vtt'].forEach((f) => { const a = document.createElement('a'); a.href = `/api/ai/subs/download?key=${info.key}&fmt=${f}`; a.textContent = f.toUpperCase(); a.setAttribute('download', ''); row.appendChild(a); });
    aiUi.files.append(nm, row);
  }
}
function aiRowLabel(meta) { return `${meta.mode === 'quick' ? 'Quick' : 'AI'} \u00b7 ${meta.lang === 'auto' ? 'auto-detect' : meta.lang}${meta.translate ? ' \u2192 English' : ''}`; }
function aiAddRow(key, meta) {
  const have = [...subTrackList.querySelectorAll('[data-ai-key]')].find((r) => r.dataset.aiKey === key);
  if (have) { if (meta) have.textContent = aiRowLabel(meta); aiRowKey = key; return have; }      // every generated subtitle stays in the list
  const row = document.createElement('div');
  row.className = 'opt-row';
  row.dataset.aiKey = key;
  row.textContent = meta ? aiRowLabel(meta) : (aiMode === 'quick' ? 'Quick subtitles' : 'AI subtitles');
  row.onclick = () => { selectOptRow(subTrackList, row); selectSubtitleUrl(`/api/ai/subs/vtt?key=${key}`); vpSet(activeVideoPath, { sub: 'ai:' + key }); };
  subTrackList.appendChild(row);
  aiRowKey = key;
  return row;
}
async function aiCheck(file, autoUse) {
  try {
    const info = await (await fetch(`/api/ai/subs?${aiQuery(file)}&from=${Math.floor(absoluteTime() || 0)}`)).json();
    if (info.error) return null;
    aiShow(info);
    if (info.state === 'done') {
      const row = aiAddRow(info.key);
      if (autoUse && row) { selectOptRow(subTrackList, row); selectSubtitleUrl(`/api/ai/subs/vtt?key=${info.key}`); }
    }
    return info;
  } catch (e) { return null; }
}
function aiStartPolling(file) {
  clearInterval(aiPoll);
  const forPath = file;
  aiPoll = setInterval(async () => {
    if (forPath !== activeVideoPath) { clearInterval(aiPoll); return; }
    const info = await aiCheck(forPath, false);
    if (!info) return;
    if (info.state === 'transcribing' && info.partial && info.cues !== aiLastCues) {      // live: show what is done so far
      aiLastCues = info.cues;
      const row = aiAddRow(info.key);
      const sel = subTrackList.querySelector('.opt-row.selected');
      if (row && (sel === row || !sel || sel.textContent.trim() === 'Off')) { selectOptRow(subTrackList, row); selectSubtitleUrl(`/api/ai/subs/vtt?key=${info.key}`); }
    }
    if (info.state === 'done') {
      clearInterval(aiPoll);
      showToast('Subtitles generated', 3000);
      const row = aiAddRow(info.key);
      if (row) { selectOptRow(subTrackList, row); selectSubtitleUrl(`/api/ai/subs/vtt?key=${info.key}`); vpSet(activeVideoPath, { sub: 'ai:' + info.key }); }
    } else if (['error', 'cancelled', 'none'].includes(info.state)) {
      clearInterval(aiPoll);
      if (info.state === 'error') showToast(info.msg || 'Subtitle generation failed', 5000);
    }
  }, 1500);
}
async function aiGenerate(file, priority) {
  if (window.astraBatteryCheck) astraBatteryCheck('task');
  const res = await fetch('/api/ai/subs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, audioTrack: activeAudioStreamIndex, lang: aiUi.lang.value, translate: aiUi.tr.checked, songs: aiUi.songs.checked, online: aiUi.online.checked, engine: curEngineKey(), fallback: curFallbackKey(), mode: aiMode, priority: !!priority, from: priority ? Math.floor(absoluteTime() || 0) : 0 })
  });
  return res.json();
}
aiUi.gen.onclick = async () => {
  if (!activeVideoPath) return;
  const info = await aiGenerate(activeVideoPath, true);
  if (info.error) { showToast(info.error, 5000); return; }
  aiShow(info);
  if (info.state === 'done') { aiCheck(activeVideoPath, true); return; }
  aiStartPolling(activeVideoPath);
};
aiUi.all.onclick = async () => {
  if (!activeVideoPath) return;
  let n = 0;
  for (const it of currentVideoList) {
    const f = it.relPath || it.fullPath;
    if (!f) continue;
    const info = await aiGenerate(f, f === activeVideoPath);
    if (info && !info.error && info.state !== 'done') n++;
  }
  showToast(n ? `Queued ${n} episode${n > 1 ? 's' : ''} — they run one at a time` : 'All episodes already have subtitles', 3500);
  aiCheck(activeVideoPath, false).then((i) => { if (i && ['queued', 'extracting', 'transcribing'].includes(i.state)) aiStartPolling(activeVideoPath); });
};
aiUi.cancel.onclick = async () => {
  const info = await aiCheck(activeVideoPath, false);
  if (info && info.key) await fetch('/api/ai/subs/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: info.key }) });
  clearInterval(aiPoll);
  aiCheck(activeVideoPath, false);
};
[aiUi.lang, aiUi.tr, aiUi.songs, aiUi.online].forEach((el) => el.addEventListener('change', () => { if (activeVideoPath) aiCheck(activeVideoPath, false); }));
async function aiLoadExisting(path) {
  try {
    const d = await (await fetch(`/api/ai/subs/for?file=${encodeURIComponent(path)}`)).json();
    if (path !== activeVideoPath) return;
    const items = d.items || [];
    const done = items.filter((i) => i.state === 'done');
    const best = done.find((i) => i.mode !== 'quick') || done[0];
    if (best) {
      const rows = new Map();
      done.slice().sort((a, b) => (a.mode === 'quick') - (b.mode === 'quick')).forEach((i) => rows.set(i.key, aiAddRow(i.key, i)));      // AI first, then Quick: all stay selectable
      const vp = vpGet(path);
      const sel = subTrackList.querySelector('.opt-row.selected');
      const nothing = !sel || sel.textContent.trim() === 'Off';
      const wantKey = vp.sub && vp.sub.startsWith('ai:') ? vp.sub.slice(3) : null;
      const pick = wantKey && rows.get(wantKey) ? done.find((i) => i.key === wantKey) : best;
      if (rows.get(pick.key) && (vp.sub === 'ai' || wantKey || (vp.sub === undefined && nothing))) { selectOptRow(subTrackList, rows.get(pick.key)); selectSubtitleUrl(`/api/ai/subs/vtt?key=${pick.key}`); }
      if ([...aiUi.lang.options].some((o) => o.value === best.lang)) aiUi.lang.value = best.lang;
      aiUi.tr.checked = !!best.translate;
      aiUi.songs.checked = !!(best.songs);
      setAiMode(best.mode === 'quick' ? 'quick' : 'ai', false);
      aiShow({ state: 'done', pct: 100, key: best.key, name: best.name });
    }
  } catch (e) {}
}
function aiOnEpisodeLoaded() {
  aiRowKey = null; aiLastCues = -1;
  aiShow(null);
  if (activeVideoPath) {
    const vp = vpGet(activeVideoPath);
    setSubDelay(vp.delay || 0);
    if (vp.sub && vp.sub.startsWith('f:')) {                       // external subtitle file chosen earlier
      const full = vp.sub.slice(2);
      addExternalSubtitle(full.split('/').pop(), full);
    }
  }
  if (!aiAvailable && !activeVideoPath) return;
  if (activeVideoPath) {
    aiLoadExisting(activeVideoPath).then(() => {
      if (!aiAvailable || !activeVideoPath) return;
      aiCheck(activeVideoPath, false).then((info) => {
        if (info && ['queued', 'extracting', 'transcribing'].includes(info.state)) aiStartPolling(activeVideoPath);
      });
    });
  }
}
fetch('/api/ai/capabilities').then((r) => r.json()).then((c) => {
  aiAvailable = !!c.available;
  aiUi.gen.disabled = aiUi.all.disabled = !aiAvailable;
  aiLocal = !!c.local;
  aiVad = !!c.vad;
  setAiMode(aiMode, false);
  if (!aiAvailable) aiUi.hint.textContent = 'Needs whisper.cpp and a model on the device \u2014 see README "AI subtitles".';
}).catch(() => {});

/* ------------------------------------------------------------------ */
/* Task manager                                                        */
/* ------------------------------------------------------------------ */
const tasksList = $('tasksList');
let tasksData = [];
const fmtMin = (sec) => { sec = Math.max(0, Math.round(sec || 0)); const m = Math.floor(sec / 60), r = sec % 60; return m ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`; };

function openByPath(relPath) {
  const key = Object.keys(fullLibrary).find((k) => fullLibrary[k].some((e) => (e.relPath || e.fullPath) === relPath));
  const h = historyCache[relPath];
  navigateTo('player');
  if (!key) {
    currentPathTokens = [];
    currentVideoList = [{ name: relPath.split('/').pop(), relPath }];
    inspectMediaAndPlay(relPath.split('/').pop(), relPath, h ? resumeStartTime(h) : 0);
    return;
  }
  const ep = fullLibrary[key].find((e) => (e.relPath || e.fullPath) === relPath);
  currentPathTokens = key === 'Anime Root' ? [] : key.split(' / ');
  currentVideoList = fullLibrary[key];
  inspectMediaAndPlay(ep.name, relPath, h ? resumeStartTime(h) : 0);
}

function taskGroup(t) {
  if (['transcribing', 'extracting', 'running', 'queued'].includes(t.state)) return 'active';
  if (t.state === 'paused') return 'paused';
  if (['error', 'failed'].includes(t.state)) return 'failed';
  if (['cancelled', 'aborted', 'stopped'].includes(t.state)) return 'aborted';
  return 'completed';
}

const TM_IC = {
  pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  stop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4"/></svg>',
  retry: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>',
  done: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  fail: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="6" x2="12" y2="13"/><circle cx="12" cy="18" r="1" fill="currentColor"/></svg>',
  wait: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>',
  open: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><polygon points="10 9 16 12 10 15 10 9" fill="currentColor"/></svg>',
  halt: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>'
};
function taskCard(t) {
  const grp = taskGroup(t);
  const live = grp === 'active';
  const pct = t.pct == null ? (grp === 'completed' ? 100 : 0) : Math.max(0, Math.min(100, Number(t.pct)));
  const card = document.createElement('div');
  card.className = `tcard st-${grp}`;
  const isTc = t.type === 'transcode';
  const kind = isTc ? 'Converting video' : (t.label || 'Task');
  const word = t.state === 'queued' ? 'Waiting' : { active: 'Running', paused: 'Paused', failed: 'Failed', aborted: 'Canceled', completed: 'Completed' }[grp];
  const time = grp === 'active' ? (t.eta != null ? `about ${fmtMin(t.eta)} left` : `<span class="tc-tick" data-e="${t.elapsed || 0}" data-at="${Date.now()}">${fmtMin(t.elapsed || 0)}</span>`) : t.state === 'queued' ? 'in line' : fmtMin(t.elapsed || 0);
  const lead = grp === 'active' && t.state !== 'queued' ? `<div class="tc-ring" style="--p:${pct}"><span>${Math.round(pct)}%</span></div>`
    : `<div class="tc-ico">${grp === 'completed' ? TM_IC.done : grp === 'failed' ? TM_IC.fail : grp === 'paused' ? TM_IC.pause : t.state === 'queued' ? TM_IC.wait : TM_IC.halt}</div>`;
  let line = '';
  if (grp === 'failed' && t.msg) line = `<div class="tc-live bad">${escapeHtml(t.msg.replace(/^Error:\s*/i, ''))}</div>`;
  else if (isTc && t.speed) line = `<div class="tc-live">${t.height ? t.height + 'p · ' : ''}${t.speed.toFixed(2)}x${t.speed < 0.95 ? ' · slower than playback' : ''}</div>`;
  else if (t.last && grp === 'active') line = `<div class="tc-live">“${escapeHtml(t.last)}”</div>`;
  else if (grp === 'paused' && t.msg) line = `<div class="tc-live">${escapeHtml(t.msg)}</div>`;
  else if (t.msg && grp === 'active') line = `<div class="tc-live">${escapeHtml(t.msg)}</div>`;
  card.innerHTML = `${lead}<div class="tc-main"><div class="tc-title">${escapeHtml(cleanMediaTitle(t.title || t.file || ''))}</div>
    <div class="tc-sub"><b>${word}</b> · ${escapeHtml(kind)} · ${time}</div>
    ${live || (grp === 'paused' && pct > 0) ? `<div class="tc-bar"><i style="width:${pct}%"></i></div>` : ''}${line}</div><div class="tc-btns"></div>`;
  const btns = card.querySelector('.tc-btns');
  const mk = (ic, label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tm-ic ' + (cls || ''); b.innerHTML = ic; b.setAttribute('aria-label', label); b.title = label; b.onclick = fn; btns.appendChild(b); };
  const post = async (url) => { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) }); refreshTasks(); };
  if (t.canPause) mk(TM_IC.pause, 'Pause', '', () => post('/api/tasks/pause'));
  if (grp === 'paused' && t.type === 'ai') mk(TM_IC.play, 'Resume', 'hl', () => post('/api/tasks/resume'));
  if (live || grp === 'paused') mk(TM_IC.stop, grp === 'paused' ? 'Cancel' : 'Stop', 'danger', async () => {
    await fetch('/api/tasks/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) });
    refreshTasks();
  });
  if (t.type === 'ai' && t.file) {
    if (grp === 'failed' || grp === 'aborted') mk(TM_IC.retry, 'Try again', 'hl', async () => {
      await fetch('/api/ai/subs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: t.file, ...t.opts, priority: true }) });
      refreshTasks();
    });
    mk(TM_IC.open, 'Open video', '', () => openByPath(t.file));
  }
  return card;
}

let taskFilter = 'all';
function renderTasks() {
  const G = (g) => tasksData.filter((t) => taskGroup(t) === g);
  const map = { active: G('active'), paused: G('paused'), failed: G('failed'), aborted: G('aborted'), completed: G('completed') };
  const sel = $('taskFilterSel');
  if (sel && sel.value !== taskFilter) sel.value = taskFilter;
  const shown = taskFilter === 'all' ? tasksData.length : map[taskFilter].length;
  $('tmCount').textContent = shown;
  $('btnTasksStopAll').disabled = !map.active.length;
  $('btnTasksClear').disabled = !(map.failed.length + map.aborted.length + map.completed.length);
  tasksList.textContent = '';
  const empty = (txt) => { const e = document.createElement('div'); e.className = 'tm-empty'; e.innerHTML = `<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg><p>${txt}</p>`; tasksList.appendChild(e); };
  if (!tasksData.length) { empty('No tasks yet.<br>AI subtitle jobs show up here. If the app closes, unfinished ones wait here as Paused so you can resume them.'); return; }
  const order = [['Running', 'active'], ['Paused', 'paused'], ['Failed', 'failed'], ['Canceled', 'aborted'], ['Completed', 'completed']];
  let any = false;
  order.forEach(([label, k]) => {
    if (taskFilter !== 'all' && taskFilter !== k) return;
    const list = map[k]; if (!list.length) return; any = true;
    if (taskFilter === 'all') { const h = document.createElement('div'); h.className = 'tm-sec'; h.textContent = label; tasksList.appendChild(h); }
    list.forEach((t) => tasksList.appendChild(taskCard(t)));
  });
  if (!any) empty('Nothing here.');
}
const taskSel = $('taskFilterSel');
if (taskSel) taskSel.addEventListener('change', () => { taskFilter = taskSel.value; renderTasks(); });

function updateTaskBadge(n) {
  const b = $('taskBadge');
  if (!b) return;
  b.textContent = n > 9 ? '9+' : n;
  b.hidden = !n;
}

async function refreshTasks() {
  try {
    const d = await (await fetch('/api/tasks')).json();
    tasksData = d.tasks || [];
    const activeCount = tasksData.filter((t) => taskGroup(t) === 'active').length;
    const queueCount = 0;
    const errorCount = tasksData.filter((t) => taskGroup(t) === 'failed').length;
    updateTaskBadge(activeCount + queueCount);
    if (currentView === 'tasks') renderTasks();
  } catch (e) {}
}

$('btnTasksStopAll').onclick = async () => {
  if (!(await astraConfirm('Everything running right now will be cancelled.', { title: 'Stop all tasks?', ok: 'Stop all', danger: true }))) return;
  await fetch('/api/tasks/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'all' }) });
  refreshTasks();
};
if ($('btnBattery')) $('btnBattery').onclick = () => { try { window.AstraNative.openBattery(); } catch (e) {} };
$('btnTasksClear').onclick = async () => { await fetch('/api/tasks/clear', { method: 'POST' }); refreshTasks(); };
setInterval(() => { if (!document.hidden) refreshTasks(); }, 1000);
/* the running timer moves every second on its own (stopped, paused and finished tasks keep their time) */
setInterval(() => {
  if (document.hidden) return;
  document.querySelectorAll('.tc-tick').forEach((el) => { el.textContent = fmtMin(Number(el.dataset.e) + (Date.now() - Number(el.dataset.at)) / 1000); });
}, 1000);
refreshTasks();

{
  let t = null;
  const queue = () => { clearTimeout(t); t = setTimeout(saveCurrentSettings, 300); };
  ['input', 'change', 'click'].forEach((ev) => $('settingsModal').addEventListener(ev, queue, true));
  window.addEventListener('pagehide', saveCurrentSettings);
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
loadSavedSettings();
{
  const boot = (window.location.hash || '').replace(/^#/, '');
  if (boot.startsWith('player/')) { pendingDeepLink = boot; navigateTo(boot); }
  else navigateTo(boot && boot !== 'player' ? boot : 'home');
}
loadLibrary(true);

/* ------------------------------------------------------------------ */
/* v1.15 precise sliders: - / + buttons (hold to repeat) around every settings slider */
(function fineSliders() {
  document.querySelectorAll('input.custom-range').forEach((rng) => {
    if (rng.parentElement.classList.contains('rng-wrap') || rng.closest('.vsl-wrap')) return;
    const wrap = document.createElement('div'); wrap.className = 'rng-wrap';
    rng.parentNode.insertBefore(wrap, rng);
    const mk = (txt, dir, label) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rng-btn'; b.textContent = txt; b.setAttribute('aria-label', label);
      const step = () => {
        const st = parseFloat(rng.step) || 1, mn = parseFloat(rng.min), mx = parseFloat(rng.max);
        const dec = (String(st).split('.')[1] || '').length;
        let v = Math.min(mx, Math.max(mn, parseFloat(rng.value) + dir * st));
        rng.value = v.toFixed(dec);
        rng.dispatchEvent(new Event('input', { bubbles: true })); rng.dispatchEvent(new Event('change', { bubbles: true }));
      };
      let t1 = null, t2 = null;
      const stop = () => { clearTimeout(t1); clearInterval(t2); };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); step(); t1 = setTimeout(() => { t2 = setInterval(step, 70); }, 450); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop));
      return b;
    };
    wrap.appendChild(mk('−', -1, 'Decrease'));
    wrap.appendChild(rng);
    wrap.appendChild(mk('+', 1, 'Increase'));
  });
})();

['play', 'pause', 'seeked', 'ratechange'].forEach((ev) => video.addEventListener(ev, () => setTimeout(assSyncAnims, 0)));

// small click animations on the player buttons (arrows nudge, speaker pops)
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('#volBtn');
  if (!b) return;
  b.classList.remove('anim'); void b.offsetWidth; b.classList.add('anim');
  setTimeout(() => b.classList.remove('anim'), 450);
}, true);
video.addEventListener('volumechange', syncVolIcon);

/* ---- subtitle: save to file / remove / generate again ---- */
function vttToSrtClient(v) {
  let n = 0;
  return String(v).replace(/\r/g, '').split(/\n\n+/).map((b) => {
    const L = b.split('\n'); const i = L.findIndex((x) => x.includes('-->'));
    if (i < 0) return '';
    const t = L[i].replace(/\./g, ',').replace(/<[^>]+>/g, '');
    const txt = L.slice(i + 1).join('\n').replace(/^<(?:ass|pos|position):[^>]*>/gm, '').trim();
    return txt ? `${++n}\n${t}\n${txt}\n` : '';
  }).filter(Boolean).join('\n');
}
/* Saved things go to Download/<AppName>-subtitles and Download/<AppName>-backup (the app name comes from Settings > App name). */
function appFolder(kind) {
  let n = 'Astra Player';
  try { n = localStorage.getItem('astra_appname') || n; } catch (e) {}
  n = n.replace(/[^A-Za-z0-9]+/g, '') || 'AstraPlayer';
  return n + '-' + kind;
}
const subDownload = async () => {
  const row = subTrackList.querySelector('.opt-row.selected');
  if (!row || !mainTrack.src || row.textContent.trim() === 'Off') { showToast('Pick a subtitle first', 2200); return; }
  try {
    const base = (cleanMediaTitle(activeVideoPath.split('/').pop() || 'subtitles') || 'subtitles').replace(/[\\/:*?"<>|]+/g, ' ');
    const txt = await (await fetch(mainTrack.src)).text();
    if (window.astraNativeSave) {   // app: save into Download/<AppName>-subtitles
      const where = window.astraNativeSave(`${base}.srt`, vttToSrtClient(txt), appFolder('subtitles'));
      showToast(where ? 'Subtitle saved: ' + where : 'Could not save the subtitle', 3500, where ? 'ok' : 'err');
      try { if (typeof refreshDownloads === 'function') refreshDownloads(); } catch (e) {}
      return;
    }
    const blob = new Blob([vttToSrtClient(txt)], { type: 'application/x-subrip' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${base}.srt`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    showToast('Subtitle saved (.srt)', 2200);
  } catch (e) { showToast('Could not save the subtitle', 2500); }
};
const subRemove = async () => {
  const row = subTrackList.querySelector('.opt-row.selected');
  if (!row || row.textContent.trim() === 'Off') { showToast('Nothing to remove - subtitles are off', 2200); return; }
  if (!row.dataset.aiKey && !row.dataset.extPath) { showToast('Built-in tracks cannot be removed - choose Off instead', 3000); return; }
  if (!(await astraConfirm('The selected subtitle will be removed.', { title: 'Remove subtitle?', ok: 'Remove', danger: true }))) return;
  if (row.dataset.aiKey) {
    try { const r = await fetch('/api/ai/subs/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: row.dataset.aiKey }) }); const j = await r.json(); if (!r.ok) { showToast(j.error || 'Could not remove', 3000); return; } } catch (e) { showToast('Server not reachable', 2500); return; }
    aiShow(null);
  }
  row.remove();
  const off = subTrackList.querySelector('.opt-row');
  if (off) off.click();
  showToast('Subtitle removed', 2000);
  if (activeVideoPath) aiCheck(activeVideoPath, false);
};
// "Generate" turns into "Generate again" once this mode + language already has a result
(function () {
  const lbl = aiUi.gen.querySelector('span');
  const sync = (info) => { lbl.textContent = info && info.state === 'done' ? 'Generate again' : 'Generate'; };
  const _show = aiShow; aiShow = function (info) { _show(info); sync(info); };
  aiUi.gen.onclick = async () => {
    if (!activeVideoPath) return;
    const again = lbl.textContent === 'Generate again';
    if (again && !(await astraConfirm('A fresh subtitle will replace the existing one. To keep it and add another, change the mode or language first.', { title: 'Replace subtitle?', ok: 'Replace' }))) return;
    const res = await fetch('/api/ai/subs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: activeVideoPath, audioTrack: activeAudioStreamIndex, lang: aiUi.lang.value, translate: aiUi.tr.checked, songs: aiUi.songs.checked, online: aiUi.online.checked, engine: curEngineKey(), fallback: curFallbackKey(), mode: aiMode, priority: true, from: Math.floor(absoluteTime() || 0), force: again }) });
    const info = await res.json();
    if (info.error) { showToast(info.error, 5000); return; }
    if (again) { const old = subTrackList.querySelector(`[data-ai-key="${info.key}"]`); if (old) old.remove(); }
    aiShow(info);
    if (info.state === 'done') { aiCheck(activeVideoPath, true); return; }
    aiStartPolling(activeVideoPath);
  };
})();
// the file picker must be visible inside fullscreen too (only the player is fullscreen): park it in the player while open
(function () {
  const m = $('subPickerModal'), home = m.parentNode;
  const place = () => { const host = document.fullscreenElement || ($('playerWrapper').classList.contains('fake-fs') ? $('playerWrapper') : null); (host || home).appendChild(m); };
  new MutationObserver(() => { if (m.classList.contains('open')) place(); else if (m.parentNode !== home) home.appendChild(m); }).observe(m, { attributes: true, attributeFilter: ['class'] });
})();

/* ===== v1.20 settings widgets (Compact Dropdown + Inline Custom Combo Box) ===== */
(function () {
  const fmtT = (sec) => (sec < 1 ? "0 s" : sec < 90 ? `${Math.round(sec)} seconds` : `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`);
  const fmtMB = (mb) => (mb >= 1024 && mb % 1024 === 0 ? `${mb / 1024} GB` : `${mb} MB`);
  const PRESETS = [0, 1, 5, 10];
  const picks = [...document.querySelectorAll(".mem-pick")];
  const tcOf = (key) => key === "preBufMB10";
  const SAVE_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
  const CHEV_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  function noteText(key, mb) {
    const sec = bufSeconds(mb, tcOf(key)), real = tcOf(key) && mb > 0 ? Math.max(5, sec) : sec;
    return mb > 0
      ? `≈ ${fmtT(real)} of ${activeVideoPath ? "this video" : "a typical 720p video"} is loaded before it starts${sec >= 600 ? " (max 10 min)" : ""}`
      : (tcOf(key) ? "Starts after a 5 second head start" : "Starts right away");
  }

  function render(el) {
    const key = el.dataset.mem, mb = Number(prefs[key]) || 0, isCompact = el.classList.contains("compact");
    const isPreset = PRESETS.includes(mb);
    const editing = el.dataset.edit === "1" || (isCompact && !isPreset);
    el.innerHTML = "";

    const sel = document.createElement("select");
    sel.className = "pref-select";
    sel.setAttribute("aria-label", "Pre-buffer memory");
    PRESETS.forEach((p) => sel.add(new Option(p ? `${p} MB` : "Off", String(p))));
    if (!isPreset && !isCompact) sel.add(new Option(`${fmtMB(mb)} (custom)`, "cur"));
    sel.add(new Option("Custom…", "custom"));
    sel.value = editing ? "custom" : (isPreset ? String(mb) : "cur");

    const extNote = document.getElementById(`note-${key}`);
    const updateNote = (valMb) => {
      const txt = noteText(key, valMb);
      if (extNote) extNote.textContent = txt;
      const inNote = el.querySelector(".mem-note");
      if (inNote) inNote.textContent = txt;
    };

    sel.onchange = () => {
      if (sel.value === "custom") { el.dataset.edit = "1"; render(el); return; }
      if (sel.value === "cur") return;
      prefs[key] = Number(sel.value);
      el.dataset.edit = "0";
      savePrefs();
      renderAll();
    };

    if (editing) {
      const comboWrap = document.createElement("div");
      comboWrap.className = "prebuf-custom-combo";

      const box = document.createElement("div");
      box.className = "prebuf-combo-box";

      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.max = "4096";
      inp.step = "1";
      inp.value = String(mb || 50);
      inp.setAttribute("aria-label", "Custom MB");
      inp.oninput = () => updateNote(Math.max(0, parseFloat(inp.value) || 0));

      const unit = document.createElement("span");
      unit.className = "prebuf-unit";
      unit.textContent = "MB";

      const arrowBtn = document.createElement("button");
      arrowBtn.type = "button";
      arrowBtn.className = "prebuf-arrow-btn";
      arrowBtn.title = "Select preset";
      arrowBtn.innerHTML = CHEV_ICON;

      el.appendChild(sel);
      box.append(inp, unit, arrowBtn);

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "prebuf-save-btn";
      saveBtn.title = "Save custom buffer";
      saveBtn.innerHTML = SAVE_ICON;
      saveBtn.onclick = () => {
        const n = Math.max(0, Math.round((parseFloat(inp.value) || 0) * 100) / 100);
        prefs[key] = n;
        el.dataset.edit = PRESETS.includes(n) ? "0" : "1";
        savePrefs();
        renderAll();
        showToast(`Pre-buffer saved: ${fmtMB(n)}`, 1400);
      };
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveBtn.click(); } });

      comboWrap.append(box, saveBtn);
      el.appendChild(comboWrap);

      requestAnimationFrame(() => {
        const csBtn = el.querySelector(".cs-btn");
        if (csBtn) {
          el.querySelector(".cs").classList.add("prebuf-hidden-cs");
          arrowBtn.onclick = (e) => { e.stopPropagation(); csBtn.click(); };
        }
      });
    } else {
      el.appendChild(sel);
    }

    if (!isCompact) {
      const note = document.createElement("div");
      note.className = "mem-note";
      el.appendChild(note);
    }
    updateNote(mb);
  }

  function renderAll() { picks.forEach((p) => render(p)); }
  picks.forEach((p) => p.addEventListener('astra-refresh', () => render(p)));
  window.renderMemPickers = renderAll;
  renderAll();
})();
// auto-play toggles inside the player settings
document.querySelectorAll('[data-pref]').forEach((el) => {
  el.checked = prefs[el.dataset.pref] !== false && !!prefs[el.dataset.pref];
  el.addEventListener('change', () => { prefs[el.dataset.pref] = el.checked; savePrefs(); const o = document.getElementById('pref' + el.dataset.pref[0].toUpperCase() + el.dataset.pref.slice(1)); if (o) o.checked = el.checked; document.querySelectorAll('[data-pref="' + el.dataset.pref + '"]').forEach((x) => { x.checked = el.checked; }); });
});
['prefAutoPlay', 'prefAutoNext'].forEach((id) => { const el = $(id); if (el) el.addEventListener('change', () => { document.querySelectorAll('[data-pref="' + id.slice(4, 5).toLowerCase() + id.slice(5) + '"]').forEach((m) => { m.checked = el.checked; }); }); });
// every Save button: store everything now (and sync to the other devices)
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.save-btn');
  if (!b) return;
  try { saveCurrentSettings(); savePrefs(); if (typeof window.syncFlush === 'function') window.syncFlush(); } catch (x) {}
  const sp = b.querySelector('span'), old = sp ? sp.textContent : '';
  b.classList.add('saved'); if (sp) sp.textContent = 'Saved';
  setTimeout(() => { b.classList.remove('saved'); if (sp) sp.textContent = old; }, 1400);
});

// Sliders: a tap on the bar no longer jumps the value (it used to change by accident while scrolling the panel).
// Grab the round handle and drag, or use the - / + buttons. Vertical swipes scroll the panel.
(function () {
  const near = (r, e) => {
    const min = +r.min || 0, max = +r.max || 100, ratio = max > min ? (r.value - min) / (max - min) : 0;
    const box = r.getBoundingClientRect(), thumb = 24;
    return Math.abs(e.clientX - (box.left + thumb / 2 + ratio * (box.width - thumb))) <= 30;
  };
  document.addEventListener('pointerdown', (e) => {
    const r = e.target;
    if (!r || r.tagName !== 'INPUT' || r.type !== 'range' || r.id === 'timelineSlider' || !r.closest('.settings-modal, .settings-card, .prefs-card')) return;
    if (!near(r, e)) { e.preventDefault(); r.blur(); if (!window._sliderHint || Date.now() - window._sliderHint > 4000) { window._sliderHint = Date.now(); showToast('Drag the handle or use − / +', 1800); } }
  }, true);
})();

// Name tips: touch tips require a genuine stationary 650 ms hold.
// Android browsers synthesize mouseover after taps; ignore those completely.
(function () {
  const bubble = document.createElement('div');
  bubble.className = 'tip-bubble';
  document.body.appendChild(bubble);
  let timer = null, hideT = null, shown = null, startX = 0, startY = 0, activePointer = null;
  const clearHold = () => {
    clearTimeout(timer);
    timer = null;
    document.querySelectorAll('.tip-hold').forEach((x) => x.classList.remove('tip-hold'));
    activePointer = null;
  };
  const hide = () => {
    clearTimeout(hideT);
    bubble.classList.remove('on');
    shown = null;
  };
  const place = (b) => {
    bubble.textContent = b.dataset.tip;
    bubble.style.maxWidth = '220px';
    bubble.classList.add('on');
    const r = b.getBoundingClientRect(), bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    let top = r.top - bh - 10;
    if (top < 6) top = r.bottom + 10;
    if (top + bh > innerHeight - 6) top = r.top - bh - 10;
    const left = Math.max(8, Math.min(innerWidth - bw - 8, r.left + r.width / 2 - bw / 2));
    bubble.style.left = left + 'px';
    bubble.style.top = Math.max(6, top) + 'px';
  };
  const show = (b) => {
    shown = b;
    place(b);
    clearTimeout(hideT);
    hideT = setTimeout(hide, 2200);
  };
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('[data-tip]');
    hide();
    clearHold();
    if (!b || e.pointerType === 'mouse') return;
    activePointer = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    b.classList.add('tip-hold');
    b.style.setProperty('--tip-hold', '650ms');
    timer = setTimeout(() => {
      if (activePointer !== e.pointerId) return;
      b.classList.remove('tip-hold');
      show(b);
      window._tipJust = b;
    }, 650);
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (activePointer !== null && e.pointerId === activePointer &&
        (Math.abs(e.clientX - startX) > 9 || Math.abs(e.clientY - startY) > 9)) clearHold();
  }, true);
  ['pointerup', 'pointercancel', 'scroll', 'touchmove'].forEach((ev) => {
    document.addEventListener(ev, clearHold, { capture: true, passive: true });
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-tip]');
    if (b && b === window._tipJust) {
      e.preventDefault();
      e.stopPropagation();
    }
    window._tipJust = null;
  }, true);
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest && e.target.closest('[data-tip]')) e.preventDefault();
  });
  // Physical mouse hover only. Never infer hover from pointerover/mouseover on touch devices.
  if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const b = e.target.closest && e.target.closest('[data-tip]');
      if (!b) { hide(); return; }
      if (b !== shown) {
        clearTimeout(timer);
        timer = setTimeout(() => show(b), 450);
      }
    });
    document.addEventListener('pointerout', (e) => {
      if (e.pointerType === 'mouse') hide();
    });
  }
})();

/* ===== Low-memory mode (v1.21) =====
   Auto = on for phones that report <= 2 GB RAM or <= 4 cores. While it is on:
   - the home / library / history pages are emptied (thumbnails + DOM freed) when the player opens, and rebuilt when you come back
   - a video that sits paused outside the player for 90 s is unloaded (its buffer is released) and reopened at the same spot when you return
   - effects (blur, shadows, transitions) are off and the subtitle clock ticks half as often */
var videoUnloaded = false, unloadPos = 0, idleSince = 0;
function isLite() {
  const m = prefs.lite;
  if (m === 'on') return true;
  if (m === 'off') return false;
  return (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
}
function applyLite() { document.documentElement.classList.toggle('lite', isLite()); }
function liteEnterPlayer() {
  if (!isLite()) return;
  try { thumbQueue.length = 0; } catch (e) {}
  [seriesCardsGrid, $('historyGrid'), $('explorerContent')].forEach((el) => { if (el) el.replaceChildren(); });
  if (videoUnloaded && lastOpen.rel) { videoUnloaded = false; inspectMediaAndPlay(lastOpen.title, lastOpen.rel, unloadPos); }
}
function liteLeavePlayer() { idleSince = Date.now(); }
setInterval(() => {
  if (!isLite() || currentView === 'player' || videoUnloaded || !activeVideoPath || !video.getAttribute('src')) return;
  if (!video.paused) { idleSince = Date.now(); return; }
  if (Date.now() - idleSince < 90000) return;
  try {
    unloadPos = absoluteTime() || 0; videoUnloaded = true;
    video.removeAttribute('src'); video.load();
  } catch (e) { videoUnloaded = false; }
}, 10000);
applyLite();
const _lite = $('prefLite'); if (_lite) _lite.addEventListener('change', applyLite);


/* ------------------------------------------------------------------ */
/* v1.21 subtitle row actions (save / remove sit next to the name)     */
(function subRowActions() {
  const ICON_SAVE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  const ICON_DEL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
  const mkBtn = (cls, label, icon, fn) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'row-act-btn ' + cls; b.setAttribute('aria-label', label); b.title = label; b.innerHTML = icon;
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    return b;
  };
  function decorate() {
    subTrackList.querySelectorAll('.opt-row').forEach((row, i) => {
      if (i === 0 || row.querySelector('.row-act')) return; // first row is "Off"
      const name = document.createElement('span'); name.className = 'sub-name';
      while (row.firstChild) name.appendChild(row.firstChild);
      const act = document.createElement('span'); act.className = 'row-act';
      act.appendChild(mkBtn('ra-save', 'Save subtitle as .srt', ICON_SAVE, subDownload));
      act.appendChild(mkBtn('ra-del', 'Remove subtitle', ICON_DEL, subRemove));
      row.appendChild(name); row.appendChild(act);
    });
  }
  new MutationObserver(decorate).observe(subTrackList, { childList: true, subtree: true });
  decorate();
})();

/* ------------------------------------------------------------------ */
/* v1.21 safer sliders: a scroll or a stray tap never changes a setting */
(function safeSliders() {
  document.querySelectorAll('.settings-modal input.custom-range').forEach((rng) => {
    let startVal = null, sx = 0, sy = 0, locked = false, guard = false, engaged = false;
    const restore = () => { guard = true; rng.value = startVal; rng.dispatchEvent(new Event('input', { bubbles: true })); rng.dispatchEvent(new Event('change', { bubbles: true })); guard = false; };
    rng.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') { startVal = null; return; }
      startVal = rng.value; sx = e.clientX; sy = e.clientY; locked = false; engaged = false;
      // Only a grab on the thumb moves the value; touching the bare track is ignored
      const r = rng.getBoundingClientRect(), mn = +rng.min, mx = +rng.max;
      const thumbX = r.left + ((+rng.value - mn) / (mx - mn || 1)) * r.width;
      if (Math.abs(e.clientX - thumbX) > 28) locked = true;
    });
    rng.addEventListener('pointermove', (e) => {
      if (startVal === null || engaged) return;
      const dx = Math.abs(e.clientX - sx), dy = Math.abs(e.clientY - sy);
      if (dy > 8 && dy > dx) { locked = true; if (rng.value !== startVal) restore(); }
      else if (dx > 6) engaged = true;
    });
    rng.addEventListener('input', (e) => { if (!guard && locked && startVal !== null) { e.stopImmediatePropagation(); restore(); } }, true);
    ['pointerup', 'pointercancel'].forEach((ev) => rng.addEventListener(ev, () => { setTimeout(() => { startVal = null; locked = false; }, 0); }));
    rng.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  });
})();


/* ------------------------------------------------------------------ */
/* v1.22 custom UI: dropdowns, color picker, confirm dialog            */
(function customUI() {
  const CHEV = '<svg class="cs-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  const CHECK = '<svg class="cs-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  let cur = null;
  function closePop() { if (!cur) return false; cur.menu.remove(); cur.btn.classList.remove('open'); cur.btn.setAttribute('aria-expanded', 'false'); cur = null; return true; }
  window.__closePop = closePop;
  // Rectangle of el in the coordinate space of its container (the player is rotated in fake fullscreen)
  function rectIn(el, box) {
    const r = el.getBoundingClientRect();
    if (box === document.body) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    if (box.classList.contains('fake-fs')) {
      const inv = new DOMMatrix(getComputedStyle(box).transform).inverse();
      const p = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]].map(([x, y]) => inv.transformPoint(new DOMPoint(x, y)));
      const xs = p.map((q) => q.x), ys = p.map((q) => q.y), l = Math.min(...xs), t = Math.min(...ys);
      return { left: l, top: t, right: Math.max(...xs), bottom: Math.max(...ys), width: Math.max(...xs) - l, height: Math.max(...ys) - t };
    }
    const c = box.getBoundingClientRect(), ox = c.left + box.clientLeft, oy = c.top + box.clientTop;
    return { left: r.left - ox, top: r.top - oy, right: r.right - ox, bottom: r.bottom - oy, width: r.width, height: r.height };
  }
  function openPop(btn, anchor, build, cls) {
    if (cur && cur.btn === btn) { closePop(); return; }
    closePop();
    const box = btn.closest('.player-wrapper') || document.body;
    const menu = document.createElement('div'); menu.className = 'cs-menu ' + (cls || ''); menu.setAttribute('role', 'listbox');
    menu.style.position = box === document.body ? 'fixed' : 'absolute'; menu.style.visibility = 'hidden';
    build(menu, closePop); box.appendChild(menu);
    const tr = rectIn(anchor, box);
    const cw = box === document.body ? innerWidth : box.clientWidth, ch = box === document.body ? innerHeight : box.clientHeight;
    menu.style.minWidth = Math.max(tr.width, cls === 'cc-menu' ? 0 : 150) + 'px';
    const mw = menu.offsetWidth, mh = menu.scrollHeight, below = ch - tr.bottom - 10, above = tr.top - 10;
    const down = mh <= below || below >= above, avail = Math.max(120, down ? below : above);
    menu.style.maxHeight = avail + 'px';
    const h = Math.min(mh, avail);
    menu.style.left = Math.max(8, Math.min(tr.left, cw - mw - 8)) + 'px';
    menu.style.top = (down ? tr.bottom + 6 : tr.top - h - 6) + 'px';
    menu.dataset.dir = down ? 'down' : 'up'; menu.style.visibility = '';
    btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); cur = { menu, btn };
    const on = menu.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  document.addEventListener('pointerdown', (e) => { if (cur && !cur.menu.contains(e.target) && !cur.btn.contains(e.target)) closePop(); }, true);
  document.addEventListener('scroll', (e) => { if (cur && !cur.menu.contains(e.target)) closePop(); }, true);
  window.addEventListener('resize', closePop);
  document.addEventListener('keydown', (e) => {
    if (!cur) return;
    if (e.key === 'Escape') { e.stopPropagation(); const b = cur.btn; closePop(); b.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...cur.menu.querySelectorAll('.cs-opt:not(:disabled)')]; if (!items.length) return;
      e.preventDefault(); const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    }
  }, true);

  const valDesc = (proto) => Object.getOwnPropertyDescriptor(proto, 'value');
  function enhanceSelect(sel) {
    if (sel._cs) return; sel._cs = true;
    if (sel.hasAttribute('data-pills')) {
      const g = document.createElement('div'); g.className = 'pill-group'; g.setAttribute('role', 'radiogroup');
      sel.parentNode.insertBefore(g, sel); g.appendChild(sel); sel.classList.add('cs-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
      if (sel.closest('.setting-item')) sel.closest('.setting-item').classList.add('has-pills');
      const paint = () => g.querySelectorAll('.pill-opt').forEach((p) => { const on = p.dataset.v === sel.value; p.classList.toggle('active', on); p.setAttribute('aria-checked', on ? 'true' : 'false'); });
      [...sel.options].forEach((o) => {
        const p = document.createElement('button'); p.type = 'button'; p.className = 'pill-opt'; p.dataset.v = o.value; p.setAttribute('role', 'radio'); p.textContent = o.textContent.trim();
        p.onclick = () => { sel.value = o.value; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); };
        g.insertBefore(p, sel);
      });
      const d = valDesc(HTMLSelectElement.prototype);
      Object.defineProperty(sel, 'value', { get() { return d.get.call(sel); }, set(v) { d.set.call(sel, v); paint(); }, configurable: true });
      sel.addEventListener('change', paint); paint();
      return;
    }
    const w = document.createElement('div'); w.className = 'cs'; w.style.cssText = sel.style.cssText; sel.style.cssText = '';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cs-btn';
    b.setAttribute('aria-haspopup', 'listbox'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', sel.getAttribute('aria-label') || 'Choose an option');
    b.innerHTML = '<span class="cs-val"></span>' + CHEV;
    const MARK = '<svg class="cs-ok" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9"/></svg>';
    sel.parentNode.insertBefore(w, sel); w.appendChild(b); w.appendChild(sel);
    sel.classList.add('cs-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    const sync = () => { const o = sel.options[sel.selectedIndex]; const v = b.querySelector('.cs-val'); v.textContent = o ? o.textContent.trim() : ''; if (o && o.dataset.ok) v.insertAdjacentHTML('beforeend', ' ' + MARK); };
    const d = valDesc(HTMLSelectElement.prototype);
    Object.defineProperty(sel, 'value', { get() { return d.get.call(sel); }, set(v) { d.set.call(sel, v); sync(); }, configurable: true });
    sel.addEventListener('change', sync); sync();
    b.onclick = () => openPop(b, b, (menu) => {
      [...sel.options].forEach((o, i) => {
        if (o.hidden) return;
        const it = document.createElement('button'); it.type = 'button'; it.className = 'cs-opt' + (i === sel.selectedIndex ? ' on' : '');
        it.setAttribute('role', 'option'); it.disabled = o.disabled; it.innerHTML = '<span></span>' + CHECK; it.firstChild.textContent = o.textContent.trim(); if (o.dataset.ok) it.firstChild.insertAdjacentHTML('beforeend', ' ' + MARK);
        it.onclick = () => { sel.value = o.value; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); closePop(); b.focus(); };
        menu.appendChild(it);
      });
    });
  }
  const SWATCHES = ['#ffffff', '#fde047', '#fbbf24', '#fb923c', '#ef4444', '#f472b6', '#a78bfa', '#60a5fa', '#22d3ee', '#4ade80', '#9ca3af', '#000000'];
  function enhanceColor(inp) {
    if (inp._cs) return; inp._cs = true;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cc-btn'; b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-label', 'Pick a color'); b.innerHTML = '<i></i>';
    inp.parentNode.insertBefore(b, inp); inp.classList.add('cs-native'); inp.tabIndex = -1;
    const sync = () => { b.firstChild.style.background = inp.value; };
    const d = valDesc(HTMLInputElement.prototype);
    Object.defineProperty(inp, 'value', { get() { return d.get.call(inp); }, set(v) { d.set.call(inp, v); sync(); }, configurable: true });
    sync();
    const set = (v) => { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); };
    b.onclick = () => openPop(b, b, (menu) => {
      const g = document.createElement('div'); g.className = 'cc-grid';
      SWATCHES.forEach((c) => {
        const s = document.createElement('button'); s.type = 'button'; s.className = 'cc-sw cs-opt' + (c === inp.value.toLowerCase() ? ' on' : ''); s.style.background = c; s.setAttribute('aria-label', c);
        s.onclick = () => { set(c); closePop(); }; g.appendChild(s);
      });
      const hex = document.createElement('input'); hex.className = 'cc-hex'; hex.maxLength = 7; hex.value = inp.value; hex.setAttribute('aria-label', 'Hex color');
      hex.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) set(hex.value.toLowerCase()); };
      menu.appendChild(g); menu.appendChild(hex);
    }, 'cc-menu');
  }
  const scan = (root) => {
    root.querySelectorAll('select').forEach(enhanceSelect);
    root.querySelectorAll('input[type="color"]').forEach(enhanceColor);
  };
  scan(document);
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches('select')) enhanceSelect(n); else if (n.matches('input[type="color"]')) enhanceColor(n); else scan(n); } }))).observe(document.body, { childList: true, subtree: true });

  // Confirm dialog (replaces the browser's confirm box)
  window.astraConfirm = (message, o = {}) => new Promise((resolve) => {
    const host = document.fullscreenElement || document.body;
    const scrim = document.createElement('div'); scrim.className = 'dlg-scrim';
    scrim.innerHTML = '<div class="dlg" role="alertdialog" aria-modal="true"><h4></h4><p></p><div class="dlg-act"><button type="button" class="pill-btn dlg-cancel">Cancel</button><button type="button" class="pill-btn dlg-ok"></button></div></div>';
    scrim.querySelector('h4').textContent = o.title || 'Are you sure?';
    scrim.querySelector('p').textContent = message || '';
    const ok = scrim.querySelector('.dlg-ok'); ok.textContent = o.ok || 'Confirm'; ok.classList.add(o.danger ? 'danger' : 'highlight');
    const done = (v) => { document.removeEventListener('keydown', key, true); scrim.classList.remove('on'); setTimeout(() => scrim.remove(), 160); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    document.addEventListener('keydown', key, true);
    ok.onclick = () => done(true); scrim.querySelector('.dlg-cancel').onclick = () => done(false);
    scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) done(false); });
    host.appendChild(scrim); requestAnimationFrame(() => scrim.classList.add('on')); scrim.querySelector('.dlg-cancel').focus();
  });
})();


/* ===== v1.21.1: online AI, cover art, next/previous bar, animation switch ===== */
(function v1211() {
  /* --- online AI settings (Settings > Subtitles) --- */
  const PRESETS = { groq: { base: 'https://api.groq.com/openai/v1', models: ['whisper-large-v3', 'whisper-large-v3-turbo'] }, openai: { base: 'https://api.openai.com/v1', models: ['whisper-1'] }, custom: { base: '', models: [] } };
  const st = $('onlineAiState'), key = $('oaKey'), base = $('oaBase'), model = $('oaModel'), preset = $('oaPreset'), mSel = $('oaModelSel'), chk = $('oaCheck');
  const INFO = 'Faster and more exact than offline, and can translate. Needs internet and your own API key. The key stays on this phone.';
  const say = (t, k) => { chk.textContent = t || ''; chk.className = 'sub-note' + (k ? ' ' + k : ''); };
  function paintModels(sel) {
    const p = preset.value, custom = p === 'custom';
    mSel.innerHTML = '<option value="all">All models (best first)</option>' + PRESETS[p].models.map((m) => `<option value="${m}">${m}</option>`).join('');
    const cs = mSel.closest('.oa-f').querySelector('.cs'); if (cs) cs.style.display = custom ? 'none' : '';
    mSel.style.display = custom ? 'none' : ''; model.style.display = custom ? '' : 'none'; $('oaBaseRow').style.display = custom ? '' : 'none';
    mSel.value = sel && PRESETS[p].models.includes(sel) ? sel : 'all';
    if (custom) model.value = sel && sel !== 'all' ? sel : '';
  }
  const curModel = () => preset.value === 'custom' ? (model.value.trim() || 'all') : mSel.value;
  function applyState(c) {
    key.value = ''; key.placeholder = c.configured ? c.hint + '  (saved, type to replace)' : 'Paste key';
    preset.value = c.base === PRESETS.groq.base ? 'groq' : c.base === PRESETS.openai.base ? 'openai' : 'custom';
    base.value = c.base; paintModels(c.model);
    st.textContent = c.configured ? 'Ready · ' + (c.model === 'all' ? 'all models, best first' : c.model) : INFO;
    $('oaRemove').style.display = c.configured ? '' : 'none';
    const on = aiUi.online, row = $('aiOnlineRow');
    on.disabled = !c.configured; $('aiOnlineHint').textContent = c.configured ? '(uses your API)' : '(add key in Settings)';
    if (!c.configured) on.checked = false;
    else if (!aiLocal && !on.checked) on.checked = true;      // nothing local to fall back on
    aiUi.gen.disabled = aiUi.all.disabled = !(aiLocal || c.configured);
    row.classList.toggle('dim', !c.configured);
    if (c.configured && !aiLocal) on.checked = true;
    else if (c.configured) { try { const p = localStorage.getItem('astra_ai_engine'); if (p === 'online' && !on.checked) on.checked = true; else if (p === 'vosk' && on.checked) on.checked = false; } catch (e) {} }
    if (window.astraSyncEngine) astraSyncEngine();
  }
  function load() { return fetch('/api/ai/online').then((r) => r.json()).then(applyState).catch(() => {}); }
  preset.addEventListener('change', () => { if (PRESETS[preset.value].base) base.value = PRESETS[preset.value].base; paintModels('all'); say(''); });
  $('oaShow').onclick = () => { const show = key.type === 'password'; key.type = show ? 'text' : 'password'; $('oaShow').classList.toggle('on', show); };
  $('oaSave').onclick = async () => {
    const body = { base: base.value.trim(), model: curModel(), test: true }; if (key.value.trim()) body.key = key.value.trim();
    const btn = $('oaSave'); btn.disabled = true; say('Checking the key...', '');
    try {
      const r = await fetch('/api/ai/online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j2 = await r.json();
      if (!r.ok) { say('✗ ' + (j2.error || 'Could not save'), 'bad'); showToast(j2.error || 'Could not save', 3000, 'err'); return; }
      key.type = 'password'; $('oaShow').classList.remove('on'); applyState(j2);
      if (j2.valid === true) { say('✓ ' + j2.checkMsg, 'good'); showToast('Key is valid and saved', 2200, 'ok'); }
      else if (j2.valid === false) say('✗ ' + j2.checkMsg, 'bad');
      else say(j2.checkMsg || 'Saved', 'warn');
      if (j2.configured && !aiUi.online.checked) { aiUi.online.checked = true; aiUi.online.dispatchEvent(new Event('change')); }
    } catch (e) { say('✗ Could not save', 'bad'); } finally { btn.disabled = false; }
  };
  $('oaRemove').onclick = async () => {
    if (!(await astraConfirm('The saved key is deleted from this device. Offline subtitles still work.', { title: 'Remove API key?', ok: 'Remove', danger: true }))) return;
    try { const r = await fetch('/api/ai/online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clear: true }) }); applyState(await r.json()); say(''); showToast('Key removed', 1800); } catch (e) {}
  };
  paintModels('all'); if (PRESETS[preset.value].base) base.value = PRESETS[preset.value].base;
  setTimeout(load, 400);

  /* --- animation switch (Settings > Preferences; same rules as Low-memory mode) --- */
  function paintAnim() { document.documentElement.classList.toggle('no-anim', prefs.anim === false); }
  const pa = $('prefAnim');
  if (pa) { pa.checked = prefs.anim !== false; pa.onchange = () => { prefs.anim = pa.checked; savePrefs(); paintAnim(); showToast(pa.checked ? 'Animations on' : 'Animations off', 1800, pa.checked ? 'ok' : 'warn'); }; }
  paintAnim();

  /* --- next / previous --- */
  const pName = $('prevEpName'), nName = $('nextEpName'), pB = $('btnPrevEp'), nB = $('btnNextEp');
  function label(it) { if (!it) return '-'; const p = epCardParts(it); return (p.tag ? p.tag + ' \u00b7 ' : '') + p.title; }
  window.updateNavBar = function () {
    const i = currentVideoList.findIndex(isActiveItem), prev = i > 0 ? currentVideoList[i - 1] : null, next = i >= 0 ? currentVideoList[i + 1] : null;
    pB.disabled = !prev; nB.disabled = !next; pName.textContent = prev ? label(prev) : 'First episode'; nName.textContent = next ? label(next) : 'Last episode';
  };
  pB.onclick = () => playAdjacentEpisode(-1); nB.onclick = () => playAdjacentEpisode(1);
  video.addEventListener('loadedmetadata', updateNavBar);
  const oldRender = renderInlinePlaylist; renderInlinePlaylist = function () { const r = oldRender.apply(this, arguments); updateNavBar(); return r; };
  updateNavBar();

})();

/* ===== v1.24 Nav, Chapter Pill & Paused Info Overlay ===== */
(function initV124Hooks() {
  const ytCenterPauseBadge = $("ytCenterPauseBadge");
  if (ytCenterPauseBadge) ytCenterPauseBadge.onclick = (e) => { e.stopPropagation(); if (!isScreenLocked) togglePlayPause(); };
  const chLbl = $("chapterLabel");
  if (chLbl) chLbl.onclick = (e) => { e.stopPropagation(); toggleChaptersPanel(); };

  function syncPausedOverlay() {
    const paused = video.paused && !!activeVideoPath && !video.ended && !internalPause;
    const chPanel = $("chaptersPanel");
    const panelOpen = settingsModal.classList.contains("open") || playerEpisodesDrawer.classList.contains("open") || (chPanel && chPanel.classList.contains("open"));
    playerWrapper.classList.toggle("is-paused-ui", paused && !panelOpen && !isScreenLocked);
    playerWrapper.classList.toggle("vid-paused", !!activeVideoPath && video.paused);   // top-left title shows only while playing

    const fileName = (activeVideoPath || "").split("/").pop() || "";
    const { title, tag } = formatCardHeader(fileName);
    const seriesName = (curSeriesName() || title || "ASTRA PLAYER").toUpperCase();

    if ($("pausedSeriesBadge")) $("pausedSeriesBadge").textContent = seriesName;
    if ($("pausedAnimeTitle")) $("pausedAnimeTitle").textContent = tag ? (title + " · " + tag) : title;

    const epName = findCustomEpInfo(fileName);
    if ($("pausedEpDesc")) $("pausedEpDesc").textContent = epName || "";

    if ($("pausedWatchedPill")) {
      $("pausedWatchedPill").textContent = "Watched: " + formatTime(absoluteTime()) + " / " + formatTime(getDuration());
    }

    const h = video.videoHeight;
    const qStr = h > 0 ? (h + "p") : ($("qualityValue") ? $("qualityValue").textContent : "Auto");
    const fpsStr = (typeof currentVideoFps !== "undefined" && currentVideoFps > 0) ? ("@" + currentVideoFps + "fps") : "";
    const bitStr = sourceIs10Bit ? "10 Bit" : "8 Bit";
    if ($("pausedTechPill")) {
      $("pausedTechPill").textContent = qStr + fpsStr + " • " + bitStr;
    }
  }
  ["play", "playing", "pause", "loadedmetadata", "emptied"].forEach((ev) => video.addEventListener(ev, syncPausedOverlay));
  new MutationObserver(syncPausedOverlay).observe(settingsModal, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(syncPausedOverlay).observe(playerEpisodesDrawer, { attributes: true, attributeFilter: ["class"] });
  if ($("chaptersPanel")) new MutationObserver(syncPausedOverlay).observe($("chaptersPanel"), { attributes: true, attributeFilter: ["class"] });
})();

/* ===== v1.21.7: Files page, quality 4K, guest mode, button tips ===== */
(function v1217() {
  /* --- guest (friend through a tunnel): hide owner-only controls --- */
  fetch('/api/whoami').then((r) => r.json()).then((d) => { if (d.guest) { document.documentElement.classList.add('guest'); } }).catch(() => {});

  /* --- Files: folder suggestions while typing, count follows the screen height --- */
  const inp = $('storagePathInputField'), box = $('pathSuggest');
  let sTimer = null, sSeq = 0;
  const maxRows = () => Math.max(3, Math.min(10, Math.floor((window.innerHeight * 0.42) / 46)));
  function hideSuggest() { box.classList.remove('open'); box.innerHTML = ''; }
  async function suggest() {
    const v = inp.value;
    const i = v.lastIndexOf('/');
    const dir = i <= 0 ? '/' : v.slice(0, i), prefix = v.slice(i + 1);
    const seq = ++sSeq;
    try {
      const r = await fetch(`/api/storage/suggest?dir=${encodeURIComponent(dir)}&prefix=${encodeURIComponent(prefix)}&max=${maxRows()}`);
      const d = await r.json();
      if (seq !== sSeq || document.activeElement !== inp) return;
      box.innerHTML = '';
      (d.items || []).forEach((it) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'ps-item'; b.setAttribute('role', 'option');
        b.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span></span>';
        b.querySelector('span').textContent = it.name;
        b.onpointerdown = (e) => { e.preventDefault(); inp.value = it.fullPath + '/'; hideSuggest(); exploreFolder(it.fullPath); };
        box.appendChild(b);
      });
      box.classList.toggle('open', box.children.length > 0);
    } catch (e) { hideSuggest(); }
  }
  inp.addEventListener('input', () => { clearTimeout(sTimer); sTimer = setTimeout(suggest, 120); });
  inp.addEventListener('focus', () => { clearTimeout(sTimer); sTimer = setTimeout(suggest, 60); });
  inp.addEventListener('blur', () => setTimeout(hideSuggest, 120));
  inp.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideSuggest(); if (e.key === 'Enter') hideSuggest(); });
  if (!inp.value && libraryRoot) inp.value = libraryRoot;

  /* --- quality: 1080p / 4K warning + memory estimate --- */
  const sel = $('prefQuality'), info = $('qualityInfo');
  const Q = {
    mb5: { name: '1080p capped at 5 Mbps', mem: 160, rate: '5 Mbps', pre: 40, cpu: 'a fast phone or PC' },
    fhd: { name: 'Full HD 1080p', mem: 160, rate: '8 Mbps', pre: 40, cpu: 'a fast phone or PC' },
    qhd: { name: '2K 1440p', mem: 300, rate: '12 Mbps', pre: 70, cpu: 'a fast PC (many phones cannot keep up live)' },
    uhd: { name: '4K 2160p', mem: 520, rate: '18 Mbps', pre: 120, cpu: 'a very fast PC (most phones cannot keep up live)' }
  };
  function paintQ() {
    const q = Q[prefs.quality];
    info.style.display = q ? '' : 'none';
    if (!q) return;
    const ram = navigator.deviceMemory ? ` This device reports about ${navigator.deviceMemory} GB RAM.` : '';
    $('qualityInfoTitle').textContent = q.name + ' selected';
    $('qualityInfoText').textContent = `Heavy: about ${q.mem} MB of RAM for decoding plus about ${q.rate} of data. Needs ${q.cpu}.${ram} Applies to 10-bit / HEVC videos that are converted live; 8-bit videos play at their own size.`;
  }
  sel.addEventListener('change', async () => {
    const q = Q[sel.value];
    paintQ();
    if (!q) return;
    const ok = await astraConfirm(`${q.name} needs about ${q.mem} MB of RAM and ${q.rate}. It may stutter on phones. The 10-bit pre-buffer will be raised to ${q.pre} MB so playback has a head start.`, { title: `Use ${q.name}?`, ok: 'Use it', danger: true });
    if (!ok) { prefs.quality = 'auto'; sel.value = 'auto'; savePrefs(); paintQ(); if (isTranscodingMode && activeVideoPath) seekToTargetSecond(absoluteTime(), true, true); return; }
    if ((Number(prefs.preBufMB10) || 0) < q.pre) { prefs.preBufMB10 = q.pre; savePrefs(); document.querySelectorAll('.mem-pick').forEach((p) => p.dispatchEvent(new Event('astra-refresh'))); }
    showToast(`${q.name} on: heavy on memory`, 3200, 'warn');
  });
  paintQ();

  /* --- every button explains itself on hold/hover --- */
  const TIPS = {
    bigPlayBtn: 'Play or pause', closeSubPickerModalBtn: 'Close the subtitle list', openDrawerBtn: 'Open the menu', closeDrawerBtn: 'Close the menu', btnRescanLibrary: 'Scan the library folder again for new videos',
    openClearHistoryModalBtn: 'Delete all watch history', btnTasksClear: 'Remove finished entries from the list', btnTasksStopAll: 'Stop every running job',
    btnPrevEp: 'Play the previous episode', btnNextEp: 'Play the next episode', prevEpBtn: 'Previous episode', nextEpBtn: 'Next episode',
    heroResumeBtn: 'Continue the last video where you stopped', chaptersBtn: 'Show chapters', closeEpisodesDrawerBtn: 'Close the episode list',
    btnSubDownload: 'Save this subtitle as a file', btnSubRemove: 'Remove the selected subtitle', oaSave: 'Save the online AI settings', oaRemove: 'Delete the saved API key', oaShow: 'Show or hide the key'
  };
  function tipFor(b) {
    if (TIPS[b.id]) return TIPS[b.id];
    const t = (b.getAttribute('aria-label') || b.getAttribute('title') || '').trim();
    if (t) return t;
    const sp = (b.textContent || '').replace(/\s+/g, ' ').trim();
    return sp ? sp.charAt(0).toUpperCase() + sp.slice(1) : '';
  }
  function tipAll(root) {
    root.querySelectorAll('button, .icon-btn, .pill-btn, .action-btn, .chip-preset, .mode-card').forEach((b) => {
      if (b.hasAttribute('data-tip') || b.closest('.kp, .cs-menu')) return;
      const t = tipFor(b); if (!t) return;
      b.setAttribute('data-tip', t); if (!b.getAttribute('aria-label') && !(b.textContent || '').trim()) b.setAttribute('aria-label', t);
      b.setAttribute('data-tip-pos', b.closest('.site-header, .upload-zone-bar, .folder-action-bar, .view-header') ? 'b' : 't');
    });
  }
  tipAll(document);
  let tipT = null;
  new MutationObserver(() => { clearTimeout(tipT); tipT = setTimeout(() => tipAll(document), 250); }).observe(document.body, { childList: true, subtree: true });
})();


/* ===== TV Cast & Smart TV Wi-Fi Connect ===== */
(function initTvConnect() {
  const tvBtn = $("tvCastBtn");
  const tvModal = $("tvConnectModal");
  const closeTv = $("closeTvModalBtn");
  const nativeBtn = $("btnNativeCast");
  const scanBtn = $("btnScanTvDevices");
  const devsBox = $("tvDevicesList");
  const urlsBox = $("tvUrlsList");
  if (!tvBtn || !tvModal) return;

  async function scanDevices() {
    if (!devsBox) return;
    devsBox.innerHTML = '<span style="color:var(--muted);">Scanning local Wi-Fi devices...</span>';
    try {
      const data = await (await fetch("/api/network/devices", { cache: "no-store" })).json();
      const connected = data.connected || [];
      const nearby = data.nearby || [];
      devsBox.innerHTML = "";

      connected.forEach((d) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:var(--surface-2);padding:7px 10px;border-radius:8px;border:1px solid rgba(46,230,166,0.35);";
        row.innerHTML = `<div><b style="color:#fff;">${escapeHtml(d.label)}</b><div style="font-size:0.7rem;color:var(--muted);">${escapeHtml(d.ip)}${d.isSelf ? " (This Device)" : ""}</div></div>
          <span style="font-size:0.66rem;font-weight:800;color:var(--mint);">CONNECTED</span>`;
        devsBox.appendChild(row);
      });

      nearby.forEach((d) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:var(--surface-2);padding:7px 10px;border-radius:8px;border:1px solid var(--line);";
        row.innerHTML = `<div><b style="color:#e2e8f0;">${escapeHtml(d.label)}</b><div style="font-size:0.7rem;color:var(--muted);">${escapeHtml(d.ip)}</div></div>
          <span style="font-size:0.66rem;font-weight:700;color:#60a5fa;">ON WI-FI</span>`;
        devsBox.appendChild(row);
      });

      if (!connected.length && !nearby.length) {
        devsBox.innerHTML = '<span style="color:var(--muted);">No other device is connected right now.</span>';
      }
    } catch (e) {
      devsBox.textContent = "Device scan failed";
    }
  }

  async function openTvModal() {
    tvModal.classList.add("open");
    scanDevices();
    urlsBox.innerHTML = "Checking Wi-Fi IP...";
    try {
      const data = await (await fetch("/api/network/info")).json();
      const urls = data.urls || [];
      if (!urls.length) {
        urlsBox.innerHTML = '<span style="color:var(--muted);">Turn on Wi-Fi or the hotspot, then open this again.</span>';
        return;
      }
      urlsBox.innerHTML = "";
      urls.forEach((u) => {
        const epHash = typeof deepLinkFor === "function" && activeVideoPath ? deepLinkFor(activeVideoPath) : "";
        const fullUrl = u.url + epHash;
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--surface-2);padding:8px 10px;border-radius:8px;border:1px solid var(--line);";
        row.innerHTML = `<code style="font-size:0.78rem;color:#60a5fa;word-break:break-all;">${escapeHtml(fullUrl)}</code>
          <button type="button" class="pill-btn highlight mini">Copy</button>`;
        row.querySelector("button").onclick = () => {
          if (navigator.clipboard) navigator.clipboard.writeText(fullUrl).catch(() => {});
          showToast("TV Link copied!", 1800);
        };
        urlsBox.appendChild(row);
      });
    } catch (e) {
      urlsBox.textContent = "Could not fetch local IP";
    }
  }

  tvBtn.onclick = (e) => {
    e.stopPropagation();
    if (isScreenLocked) return;
    openTvModal();
  };
  if (scanBtn) scanBtn.onclick = () => scanDevices();
  if (closeTv) closeTv.onclick = () => tvModal.classList.remove("open");
  tvModal.addEventListener("pointerdown", (e) => { if (e.target === tvModal) tvModal.classList.remove("open"); });

  if (nativeBtn) {
    nativeBtn.onclick = async () => {
      if (video && video.remote && typeof video.remote.prompt === "function") {
        try {
          await video.remote.prompt();
          tvModal.classList.remove("open");
          return;
        } catch (err) {}
      }
      showToast("Browser cast is not available. Open the Wi-Fi link below in the TV browser", 3500, "warn");
    };
  }
})();


// Save last played video state on play / timeupdate
function saveLastPlayedState(file, time, title) {
  try {
    localStorage.setItem('astra_last_file', file);
    localStorage.setItem('astra_last_time', time);
    localStorage.setItem('astra_last_title', title);
  } catch (e) {}
}

// Restore last played video on page load if available
window.addEventListener('DOMContentLoaded', () => {
  try {
    const lastFile = localStorage.getItem('astra_last_file');
    const lastTime = localStorage.getItem('astra_last_time');
    if (lastFile && typeof loadVideo === 'function' && !window.location.hash.includes('play=')) {
      // Optional: auto load last video or prepare player state
      console.log("Restoring last played state for:", lastFile);
    }
  } catch (e) {}
});


// Persistent Player State Across Reloads and Hash Changes
function saveActivePlayerState(file, title, time, season, episode) {
  try {
    localStorage.setItem('astra_active_file', file || '');
    localStorage.setItem('astra_active_title', title || '');
    localStorage.setItem('astra_active_time', time || 0);
    localStorage.setItem('astra_active_season', season || '');
  } catch(e) {}
}

window.addEventListener('load', () => {
  try {
    const savedFile = localStorage.getItem('astra_active_file');
    const savedTime = localStorage.getItem('astra_active_time');
    if (savedFile && window.location.hash.includes('player') && typeof loadVideo === 'function') {
      // Restore if returning to player
      console.log("Restoring active player state for:", savedFile);
    }
  } catch(e) {}
});


// Playlist Detail View Controller
function openPlaylistView(playlistData) {
  const homeView = document.getElementById('home-view') || document.querySelector('.home-container');
  const playerView = document.getElementById('player-view') || document.querySelector('.player-container');
  const playlistView = document.getElementById('playlist-view');

  if (homeView) homeView.style.display = 'none';
  if (playerView) playerView.style.display = 'none';
  if (playlistView) playlistView.style.display = 'block';

  // Populate Header
  document.getElementById('pl-title').textContent = playlistData.name || 'Unknown Anime';
  if (playlistData.thumbnail) {
    document.getElementById('pl-thumbnail').src = playlistData.thumbnail;
  }

  // Setup Season Tabs & Episodes Grid logic here
  console.log("Opened playlist overview for:", playlistData.name);
}

document.addEventListener('click', (e) => {
  const card = e.target.closest('.playlist-card, .anime-card');
  if (card && typeof openPlaylistView === 'function') {
    // Intercept default direct play and open overview instead
    // e.preventDefault();
    // openPlaylistView({ name: card.dataset.title, thumbnail: card.querySelector('img')?.src });
  }
});


// Hide/Show View Controller
function showView(viewName) {
  const homeView = document.getElementById('home-view') || document.querySelector('.home-container');
  const playerView = document.getElementById('player-view') || document.getElementById('player') || document.querySelector('.player-container');
  const overviewView = document.getElementById('playlist-view') || document.getElementById('overview');

  // Default states
  if (homeView) homeView.style.display = 'none';
  if (playerView) playerView.style.display = 'none';
  if (overviewView) overviewView.style.display = 'none';

  if (viewName === 'home' && homeView) {
    homeView.style.display = 'block';
  } else if (viewName === 'player' && playerView) {
    playerView.style.display = 'block';
  } else if (viewName === 'overview' && overviewView) {
    overviewView.style.display = 'block';
  }
}


// Dedicated Playlist Overview Controller
function openPlaylistOverview(folderName, episodes) {
  console.log("Opening playlist overview for:", folderName);
  const overviewView = document.getElementById('playlist-view');
  if (overviewView) {
    overviewView.style.display = 'block';
  } else {
    alert("Playlist view container missing!");
    return;
  }

  const titleEl = document.getElementById('pl-title');
  const thumbEl = document.getElementById('pl-thumbnail');
  const gridEl = document.getElementById('pl-episodes-grid');

  if (titleEl) titleEl.textContent = folderName;
  
  const firstEp = episodes && episodes[0];
  if (firstEp && thumbEl && typeof attachThumb === 'function') {
    attachThumb(thumbEl, firstEp.relPath || firstEp.fullPath, 'series', folderName);
  }

  if (gridEl && episodes) {
    gridEl.innerHTML = '';
    episodes.forEach((ep) => {
      const epCard = document.createElement('div');
      epCard.style.cssText = "background: #1f2937; padding: 10px; border-radius: 8px; cursor: pointer;";
      const { title } = formatCardHeader(ep.name);
      epCard.innerHTML = `<div style="font-size: 13px; color: #fff; font-weight: 500;">${title}</div>`;
      epCard.onclick = () => {
        if (overviewView) overviewView.style.display = 'none';
        if (typeof inspectMediaAndPlay === 'function') {
          inspectMediaAndPlay(ep.name, ep.relPath || ep.fullPath, 0);
        }
      };
      gridEl.appendChild(epCard);
    });
  }

  const backBtn = document.getElementById('back-to-home');
  if (backBtn) {
    backBtn.onclick = () => {
      if (overviewView) overviewView.style.display = 'none';
    };
  }
}
/* ===== Quality tab (only while a 10-bit / HEVC video is being converted live) + one-line reverb dropdown ===== */
(function () {
  try {
    const QOPTS = [
      ['auto', 'Auto', 'adapts to your phone'],
      ['uhd', '4K', '2160p · very heavy'],
      ['qhd', '2K', '1440p · heavy'],
      ['mb5', '1080p 5 Mbps', 'best quality at 5 Mbps'],
      ['fhd', '1080p', 'heavy'],
      ['balanced', '720p', 'balanced'],
      ['fast', '480p', 'fast'],
      ['low', '360p', 'lightest']
    ];
    const LBL = { low: '360p', fast: '480p', balanced: '720p', quality: '720p+', mb5: '1080p·5M', fhd: '1080p', qhd: '2K', uhd: '4K' };
    const tabBtn = $('tabBtnQuality'), list = $('qList'), now = $('qNow'), sel = $('prefQuality');
    if (!tabBtn || !list || !sel) return;
    QOPTS.forEach(([k, name, sub]) => {
      const b = document.createElement('div'); b.className = 'opt-row'; b.dataset.q = k;
      b.innerHTML = '<span class="sub-name"></span><span class="qsub"></span>';
      b.firstChild.textContent = name; b.lastChild.textContent = sub;
      b.onclick = () => {
        sel.value = k;
        sel.dispatchEvent(new Event('change', { bubbles: true }));   // saves, asks for heavy ones, restarts the stream
        paint();
        setTimeout(paint, 400);
      };
      list.appendChild(b);
    });
    function paint() {
      const cur = prefs.quality === 'quality' ? 'balanced' : prefs.quality;
      list.querySelectorAll('.opt-row').forEach((r) => r.classList.toggle('selected', r.dataset.q === cur));
      let q = ''; try { q = effectiveQuality(); } catch (e) {}
      now.textContent = q ? 'Now: ' + (LBL[q] || q) : '';
    }
    function sync() {
      const show = !!(isTranscodingMode && isCurrentFile10Bit);
      if (tabBtn.style.display !== (show ? '' : 'none')) {
        tabBtn.style.display = show ? '' : 'none';
        if (!show && tabBtn.classList.contains('active')) {
          const f = document.querySelector('.modal-tabs .tab-btn[data-target="tabFilters"]'); if (f) f.click();
        }
      }
      if (show) paint();
    }
    sel.addEventListener('change', () => setTimeout(paint, 300));
    setInterval(sync, 600);
    sync(); paint();
  } catch (e) { console.warn('quality tab', e); }
})();


/* App name: you can rename "Astra Player" (top bar, page title, welcome text). Saved on this device. */
(function () {
  const KEY = 'astra_appname', DEF = 'Astra Player';
  const get = () => { try { return (localStorage.getItem(KEY) || '').trim() || DEF; } catch (e) { return DEF; } };
  function apply() {
    const name = get(), w = name.split(/\s+/), last = w.length > 1 ? w.pop() : '', first = w.join(' ');
    document.title = name;
    document.querySelectorAll('.logo-text').forEach((el) => {
      el.textContent = first.toUpperCase() + (last ? ' ' : '');
      if (last) { const sp = document.createElement('span'); sp.textContent = last.toUpperCase(); el.appendChild(sp); }
    });
    const wl = document.querySelector('.c1-welcome'); if (wl) wl.textContent = 'Welcome back to ' + (name === DEF ? 'Astra' : name);
  }
  const inp = document.getElementById('prefAppName'), rst = document.getElementById('prefAppNameReset');
  if (inp) { inp.value = get() === DEF ? '' : get(); inp.addEventListener('input', () => { try { localStorage.setItem(KEY, inp.value.trim()); } catch (e) {} apply(); }); }
  const ic = document.getElementById('prefAppNameIcon');
  if (ic) ic.onclick = () => { if (window.AstraNative && AstraNative.pinShortcut) AstraNative.pinShortcut(get()); else showToast('Only available in the app', 2500); };
  if (rst) rst.onclick = () => { try { localStorage.removeItem(KEY); } catch (e) {} if (inp) inp.value = ''; apply(); };
  apply();
})();


/* Center Previous / Play-Pause / Next: shown and hidden together with the other controls. */
(function () {
  const c = $('centerOverlay'), cp = $('cPlayBtn'), pv = $('cPrevBtn'), nx = $('cNextBtn');
  if (!c || !cp) return;
  cp.onclick = () => { if (isScreenLocked) return; playBtn.onclick(); };
  pv.onclick = () => { if (!isScreenLocked) playAdjacentEpisode(-1); };
  nx.onclick = () => { if (!isScreenLocked) playAdjacentEpisode(1); };
  const sync = () => {
    const playing = playBtn.classList.contains('playing');
    c.classList.toggle('hidden', isScreenLocked || (playing && bottomOverlay.classList.contains('hidden')));   // paused: the three buttons stay visible
    cp.classList.toggle('playing', playBtn.classList.contains('playing'));
  };
  new MutationObserver(sync).observe(bottomOverlay, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(playBtn, { attributes: true, attributeFilter: ['class'] });
  setInterval(sync, 400);
  sync();
})();


/* Fullscreen / landscape: keep the page from scrolling so the player never ends up half off screen. */
(function () {
  const root = document.documentElement;
  const inPlayer = () => !!document.fullscreenElement || document.body.classList.contains('fake-fs-on') ||
    (window.innerWidth > window.innerHeight && !playerWrapper.classList.contains('no-video') && video && !video.paused);
  let locked = false;
  function sync() {
    const on = inPlayer();
    if (on === locked) return;
    locked = on;
    root.classList.toggle('player-locked', on);
    try { if (typeof applyFill === 'function') applyFill(); } catch (e) {}
    try { if (window.AstraNative && AstraNative.playerFs) AstraNative.playerFs(on); } catch (e) {}
    if (on) { window.scrollTo(0, 0); try { playerWrapper.scrollIntoView({ block: 'start' }); } catch (e) {} }
  }
  window.addEventListener('scroll', () => { if (locked) window.scrollTo(0, 0); }, { passive: true });
  window.addEventListener('resize', sync);
  document.addEventListener('fullscreenchange', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  setInterval(sync, 700);
})();

/* ===== Settings: offline speech models + where files are saved (app) ===== */
(function () {
  const LANG = { en: 'English', ja: 'Japanese', hi: 'Hindi', zh: 'Chinese', ko: 'Korean', ru: 'Russian', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', tr: 'Turkish', uk: 'Ukrainian', 'whisper-tiny': 'Whisper Tiny (all languages)', 'whisper-base': 'Whisper Base (all languages)' };
  const list = $('modelsList'), loc = $('locList');
  if (!list || !loc) return;
  const mb = (b) => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : Math.max(0.1, b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB';
  const post = (u, body) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then((r) => r.json());
  let timer = null;
  const mSel = $('modelSel'), mBtn = $('modelBtn'), mNote = $('modelNote'), mBar = $('modelBar');
  const IC_DL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  const IC_DEL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
  const IC_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  let models = [], selKey = 'en';
  try { selKey = localStorage.getItem('astra_model_sel') || 'en'; } catch (e) {}
  function paintModel() {
    const m = models.find((x) => x.key === selKey);
    if (!m) { mBtn.style.display = 'none'; mNote.textContent = ''; mBar.hidden = true; return; }
    mBtn.style.display = '';
    const busy = m.state === 'downloading';
    mBtn.dataset.act = busy ? 'cancel' : m.installed ? 'delete' : 'download';
    mBtn.className = 'pill-btn sub-act ' + (m.installed && !busy ? 'danger' : busy ? '' : 'highlight');
    mBtn.innerHTML = busy ? IC_X + 'Cancel' : m.installed ? IC_DEL + 'Delete' : IC_DL + 'Download';
    mBar.hidden = !busy; if (busy) mBar.firstElementChild.style.width = (m.pct || 0) + '%';
    mNote.className = 'sub-note' + (m.state === 'error' ? ' bad' : '');
    mNote.textContent = busy ? 'Downloading ' + (m.pct || 0) + '%' : m.state === 'error' ? (m.msg || 'Download failed') : m.installed ? 'Installed · ' + mb(m.bytes || 0) : 'Not downloaded · about ' + m.sizeMB + ' MB';
  }
  async function renderModels() {
    if (!window.AstraNative || !mSel) return;
    let data; try { data = await (await fetch('/api/ai/models')).json(); } catch (e) { return; }
    models = data.models || [];
    if (!models.some((m) => m.key === selKey) && models.length) selKey = models[0].key;
    mSel.innerHTML = models.map((m) => `<option value="${m.key}"${m.installed ? ' data-ok="1"' : ''}>${LANG[m.key] || m.key}</option>`).join('');
    mSel.value = selKey;
    paintModel();
    clearTimeout(timer);
    if (models.some((m) => m.state === 'downloading')) timer = setTimeout(renderModels, 900);
    else if (window.astraEngineReload) astraEngineReload();
  }
  if (mSel) mSel.addEventListener('change', () => { selKey = mSel.value; try { localStorage.setItem('astra_model_sel', selKey); } catch (e) {} paintModel(); });
  if (mBtn) mBtn.addEventListener('click', async () => {
    const k = selKey, act = mBtn.dataset.act; if (!act) return;
    if (act === 'delete' && !(await astraConfirm('You can download it again later.', { title: 'Delete the ' + (LANG[k] || k) + ' speech model?', ok: 'Delete', danger: true }))) return;
    await post('/api/ai/models/' + act, { key: k }).catch(() => {});
    renderModels();
  });
  async function renderLoc() {
    if (!window.AstraNative) { $('locCard').style.display = 'none'; return; }
    let d; try { d = await (await fetch('/api/storage/locations')).json(); } catch (e) { return; }
    const row = (t, o, clear) => `<div class="setting-item loc-row"><div><h5>${t}</h5><p class="loc-path">${escapeHtml(o.path)}</p></div><span class="loc-size">${mb(o.bytes || 0)}</span>${clear ? `<button class="pill-btn danger" data-clear="${clear}">Clear</button>` : ''}</div>`;
    loc.innerHTML = row('History, profile, settings', d.data) + row('AI subtitles', d.subtitles, 'subs') + row('Speech models (delete in AI subtitles)', d.models) + row('Thumbnail cache', d.cache, 'cache');
  }
  const dl = $('dlList');
  async function renderDownloads() {
    if (!window.AstraNative || !dl) { const c = $('dlCard'); if (c && !window.AstraNative) c.style.display = 'none'; return; }
    const parts = [];
    for (const kind of ['subtitles', 'backup']) {
      const folder = appFolder(kind);
      let d; try { d = await (await fetch('/api/downloads/list?folder=' + encodeURIComponent(folder))).json(); } catch (e) { d = {}; }
      const files = d.files || [];
      parts.push(`<div class="setting-item dl-head"><div><h5>${kind === 'subtitles' ? 'Subtitles' : 'Backups'}</h5><p class="loc-path">Download/${escapeHtml(folder)}</p></div>${files.length ? `<button class="pill-btn danger" data-dl="all" data-f="${escapeHtml(folder)}">Delete all</button>` : ''}</div>`);
      if (!files.length) parts.push('<div class="empty-hint">Nothing saved yet</div>');
      files.forEach((f) => parts.push(`<div class="setting-item loc-row"><div><h5 class="dl-name">${escapeHtml(f.name)}</h5><p>${mb(f.bytes)}</p></div><button class="pill-btn danger" data-dl="one" data-f="${escapeHtml(folder)}" data-n="${escapeHtml(f.name)}">Delete</button></div>`));
    }
    dl.innerHTML = parts.join('');
  }
  window.refreshDownloads = renderDownloads;
  if (dl) dl.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-dl]'); if (!b) return;
    const all = b.dataset.dl === 'all';
    if (!(await astraConfirm(all ? 'Every file in this folder will be deleted.' : b.dataset.n, { title: all ? 'Delete all files?' : 'Delete this file?', ok: 'Delete', danger: true }))) return;
    await post('/api/downloads/delete', { folder: b.dataset.f, name: b.dataset.n || '', all }).catch(() => {});
    renderDownloads(); renderLoc();
  });
  loc.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-clear]'); if (!b) return;
    const what = b.dataset.clear;
    if (!(await astraConfirm(what === 'subs' ? 'The AI subtitles you made will be removed (you can make them again).' : 'Thumbnails are made again when needed.', { title: 'Clear this?', ok: 'Clear', danger: true }))) return;
    await post(what === 'subs' ? '/api/ai/subs/clear' : '/api/cache/clear', {}).catch(() => {});
    renderLoc();
  });
  const refresh = () => { renderModels(); renderLoc(); renderDownloads(); };
  window.addEventListener('astra-sec', (e) => { if (e.detail === 'subs' || e.detail === 'storage') refresh(); });
  const sv = $('headerSettingsBtn'); if (sv) sv.addEventListener('click', () => setTimeout(refresh, 300));
  refresh();
})();


/* ---- Theme: accent color + pure black background ---- */
(function () {
  const root = document.documentElement;
  const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const apply = () => {
    root.dataset.accent = get('astra_accent', 'blue');
    root.classList.toggle('amoled', get('astra_amoled', '0') === '1');
    document.querySelectorAll('#accentSwatches .swatch').forEach((b) => b.classList.toggle('on', b.dataset.accent === root.dataset.accent));
    const cb = document.getElementById('prefAmoled'); if (cb) cb.checked = root.classList.contains('amoled');
  };
  apply();
  document.querySelectorAll('#accentSwatches .swatch').forEach((b) => { b.onclick = () => { set('astra_accent', b.dataset.accent); apply(); }; });
  const cb = document.getElementById('prefAmoled');
  if (cb) cb.addEventListener('change', () => { set('astra_amoled', cb.checked ? '1' : '0'); apply(); });
})();

/* ---- Sliders: filled from the neutral point, value bubble while dragging ---- */
(function () {
  const bub = document.createElement('div'); bub.className = 'rng-bubble'; document.body.appendChild(bub);
  let active = null;
  const place = () => {
    if (!active) return;
    const r = active.getBoundingClientRect(), min = parseFloat(active.min) || 0, max = parseFloat(active.max);
    const ratio = (parseFloat(active.value) - min) / ((isNaN(max) ? 100 : max) - min || 1);
    const lab = active.closest('.slider-row') && active.closest('.slider-row').querySelector('.val');
    bub.textContent = lab ? lab.textContent : active.value;
    const w = bub.offsetWidth, x = r.left + 8 + (r.width - 16) * ratio;
    bub.style.left = Math.max(w / 2 + 6, Math.min(innerWidth - w / 2 - 6, x)) + 'px';
    bub.style.top = Math.max(6, r.top - 30) + 'px';
  };
  const show = (e) => { const r = e.target; if (r.matches && r.matches('input.custom-range')) { active = r; bub.classList.add('on'); requestAnimationFrame(place); } };
  const hide = () => { active = null; bub.classList.remove('on'); };
  document.addEventListener('pointerdown', show, true);
  document.addEventListener('touchstart', show, { capture: true, passive: true });
  document.addEventListener('input', (e) => { if (active && e.target === active) requestAnimationFrame(place); }, true);
  ['pointerup', 'pointercancel', 'touchend', 'touchcancel'].forEach((n) => document.addEventListener(n, hide, true));
})();


/* ---- Settings > App info + update check ---- */
const REPO = 'astracore0/astra-player-app';
/* Versions look like 2.10.38 (stable), 2.10.38-beta.1, 2.10.38-alpha.2 or 2.10.38-experiment.1 */
const verNums = (t) => { const m = String(t || '').match(/(\d+(?:\.\d+){1,3})/); return m ? m[1].split('.').map(Number) : null; };
const RANK = { experiment: 0, alpha: 1, beta: 2, stable: 3 };
function verInfo(t) {
  const nums = verNums(t); if (!nums) return null;
  const m = String(t).match(/-\s*(experiment|experimental|exp|alpha|beta|rc)[.\-]?(\d+)?/i);
  let ch = 'stable'; if (m) { const w = m[1].toLowerCase(); ch = w === 'rc' ? 'beta' : (w === 'exp' || w === 'experimental') ? 'experiment' : w; }
  return { nums, ch, n: m && m[2] ? Number(m[2]) : 0 };
}
const verCmp = (a, b) => {
  for (let i = 0; i < Math.max(a.nums.length, b.nums.length); i++) { const d = (a.nums[i] || 0) - (b.nums[i] || 0); if (d) return d > 0 ? 1 : -1; }
  if (a.ch !== b.ch) return RANK[a.ch] > RANK[b.ch] ? 1 : -1;
  return a.n === b.n ? 0 : a.n > b.n ? 1 : -1;
};
const updChannel = () => { try { const c = localStorage.getItem('astra_upd_channel'); return RANK[c] != null ? c : 'stable'; } catch (e) { return 'stable'; } };
let aboutInfo = {};
function paintUpdate(u) {
  const box = $('updBox'); if (!box) return;
  box.innerHTML = u.html;
  const dl = box.querySelector('[data-url]'); if (dl) dl.onclick = () => { try { window.AstraNative.openUrl(dl.dataset.url); } catch (e) { window.open(dl.dataset.url, '_blank'); } };
  const ck = box.querySelector('#updCheck'); if (ck) ck.onclick = () => checkUpdate(true);
}
async function checkUpdate(manual) {
  const cur = verInfo(aboutInfo.version);
  const btn = '<button type="button" class="pill-btn" id="updCheck">Check for updates</button>';
  if (!cur) { paintUpdate({ html: '<p class="sub-note">Update check works in the Android app.</p>' }); return; }
  paintUpdate({ html: '<p class="sub-note">Checking...</p>' });
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('GitHub answered ' + r.status);
    const minRank = RANK[updChannel()];   // stable only sees stable; beta also sees beta; alpha sees alpha+; experimental sees everything
    const rel = (await r.json()).filter((x) => { if (x.draft) return false; const v = verInfo(x.tag_name); return v && RANK[v.ch] >= minRank; });
    rel.sort((x, y) => verCmp(verInfo(y.tag_name), verInfo(x.tag_name)));
    try { localStorage.setItem('astra_upd_checked', String(Date.now())); } catch (e) {}
    const top = rel[0];
    const when = new Date().toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    if (top && cur && verCmp(verInfo(top.tag_name), cur) > 0) {
      const apk = (top.assets || []).find((x) => /\.apk$/i.test(x.name));
      const notes = escapeHtml((top.body || '').replace(/\*\*/g, '').split('\n').filter(Boolean).slice(0, 6).join('\n'));
      paintUpdate({ html: `<div class="upd-new"><b>New version ${escapeHtml(top.tag_name.replace(/^v/i, ''))} is available</b><span>You have ${escapeHtml(aboutInfo.version)}</span></div><pre class="upd-notes">${notes}</pre><div class="sub-row"><button type="button" class="pill-btn highlight sub-act" data-url="${escapeHtml(apk ? apk.browser_download_url : top.html_url)}">Download</button>${btn}</div>` });
    } else paintUpdate({ html: `<p class="sub-note good">You are on the newest version</p><p class="sub-note">Checked ${when}</p>${btn}` });
  } catch (e) {
    paintUpdate({ html: `<p class="sub-note bad">Could not check for updates (${escapeHtml(e.message || 'no internet')})</p>${btn}` });
  }
}
function loadAbout() {
  const box = $('aboutList'); if (!box) return;
  let info = {};
  try { info = JSON.parse(window.AstraNative.appInfo()); } catch (e) { info = { note: 'Running in a browser' }; }
  aboutInfo = info;
  const appName = ($('headerLogoBtn') && $('headerLogoBtn').textContent.trim()) || 'Astra Player';
  const rows = [['App', appName], ['Version', info.version && info.code ? info.version + ' (build ' + info.code + ')' : info.version], ['Last updated', info.updated], ['Developer', 'AstraCore'], ['Package', info.pkg], ['Android', info.android], ['Device', info.device], ['CPU', info.abi], ['Memory', info.ram], ['Data folder', info.dataDir], ['First installed', info.installed], ['Note', info.note]];
  box.innerHTML = rows.filter((r) => r[1]).map((r) => `<div class="about-row"><span>${escapeHtml(r[0])}</span><b>${escapeHtml(String(r[1]))}</b></div>`).join('');
  $('aboutName').textContent = appName;
  const lic = $('licList'); if (lic && !lic.dataset.done) { lic.dataset.done = '1'; lic.innerHTML = [['Astra Player','MIT'],['AndroidX Media3 (ExoPlayer)','Apache-2.0'],['FFmpeg decoders via NextLib','LGPL-2.1+'],['Vosk speech recognition','Apache-2.0'],['JNA','Apache-2.0 / LGPL-2.1'],['whisper.cpp models','MIT']].map((r) => `<div class="about-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join(''); }
  $('aboutVer').textContent = info.version ? 'Version ' + info.version : '';
  let last = 0; try { last = Number(localStorage.getItem('astra_upd_checked')) || 0; } catch (e) {}
  if (!$('updBox').dataset.done || Date.now() - last > 6 * 3600e3) { $('updBox').dataset.done = '1'; checkUpdate(false); }
}
(function () {
  const sel = $('updChannel'); if (!sel) return;
  sel.value = updChannel();
  sel.addEventListener('change', () => { try { localStorage.setItem('astra_upd_channel', sel.value); } catch (e) {} showToast({ title: 'Update channel: ' + sel.options[sel.selectedIndex].text.replace('Channel: ', '') }, 2200, 'info'); checkUpdate(true); });
})();
if ($('btnGithub')) $('btnGithub').onclick = () => { try { window.AstraNative.openUrl('https://github.com/' + REPO); } catch (e) { window.open('https://github.com/' + REPO, '_blank'); } };


/* ===== Watch stats: time actually spent playing, kept on this device ===== */
const WLOG_KEY = 'astra_watch_log';
const dayKey = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
function wlogGet() { try { return JSON.parse(localStorage.getItem(WLOG_KEY) || '{}') || {}; } catch (e) { return {}; } }
let wlog = wlogGet(), wlogLast = 0, wlogDirty = 0;
video.addEventListener('timeupdate', () => {
  const now = Date.now();
  if (!video.paused && wlogLast && now - wlogLast < 2500 && now - wlogLast > 0) {
    const k = dayKey(); wlog[k] = (wlog[k] || 0) + (now - wlogLast) / 1000; wlogDirty += now - wlogLast;
    if (wlogDirty > 15000) { wlogDirty = 0; try { localStorage.setItem(WLOG_KEY, JSON.stringify(wlog)); } catch (e) {} }
  }
  wlogLast = video.paused ? 0 : now;
});
['pause', 'ended'].forEach((ev) => video.addEventListener(ev, () => { wlogLast = 0; try { localStorage.setItem(WLOG_KEY, JSON.stringify(wlog)); } catch (e) {} }));
function fmtHM(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return sec + 's';
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
async function renderStats() {
  try { const r = await fetch('/api/history'); historyCache = await r.json(); } catch (e) {}
  wlog = wlogGet();
  const today = dayKey();
  const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: dayKey(d), l: d.toLocaleDateString(undefined, { weekday: 'short' }) }); }
  const week = days.reduce((s, d) => s + (wlog[d.k] || 0), 0);
  const logTotal = Object.values(wlog).reduce((s, v) => s + v, 0);
  const items = Object.entries(historyCache || {});
  const histTotal = items.reduce((s, [, v]) => s + (Number(v.time) || 0), 0);
  let streak = 0; for (let i = 0; i < 400; i++) { const d = new Date(); d.setDate(d.getDate() - i); if ((wlog[dayKey(d)] || 0) >= 60) streak++; else if (i === 0) continue; else break; }
  $('stToday').textContent = fmtHM(wlog[today] || 0);
  $('stWeek').textContent = fmtHM(week);
  $('stTotal').textContent = fmtHM(Math.max(logTotal, histTotal));
  $('stStreak').textContent = streak + (streak === 1 ? ' day' : ' days');
  $('stDone').textContent = items.filter(([, v]) => (Number(v.percent) || 0) >= 90).length;
  $('stStarted').textContent = items.length;
  const max = Math.max(60, ...days.map((d) => wlog[d.k] || 0));
  $('stBars').innerHTML = days.map((d) => { const v = wlog[d.k] || 0; return `<div class="st-bar${d.k === today ? ' now' : ''}"><i style="height:${Math.max(3, Math.round(v / max * 100))}%"></i><span>${d.l.slice(0, 3)}</span><em>${v >= 60 ? fmtHM(v) : ''}</em></div>`; }).join('');
  const by = {};
  items.forEach(([k, v]) => { const f = findFolderForPath(k, v.name); const name = f ? seasonInfo(f).name : cleanMediaTitle(v.name || k); by[name] = (by[name] || 0) + (Number(v.time) || 0); });
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = top.length ? top[0][1] || 1 : 1;
  $('stTop').innerHTML = top.length ? top.map(([n, t], i) => `<div class="st-row"><span class="st-n">${i + 1}</span><div class="st-t"><b>${escapeHtml(n)}</b><div class="st-meter"><i style="width:${Math.round(t / topMax * 100)}%"></i></div></div><span class="st-v">${fmtHM(t)}</span></div>`).join('') : '<p class="ai-hint">Watch something and your top series show up here.</p>';
}


/* ===== Cinematic series page ===== */
function closeSeriesPage() {
  const p = $('seriesPage'); if (!p || !p.classList.contains('open')) return false;
  p.classList.remove('open'); document.documentElement.classList.remove('series-open'); return true;
}
function playFromSeries(folder, eps, ep, time) {
  currentPathTokens = folder === 'Anime Root' ? [] : folder.split(' / ');
  currentVideoList = eps;
  renderInlinePlaylist();
  closeSeriesPage();
  inspectMediaAndPlay(ep.name, ep.relPath || ep.fullPath, time || 0);
  navigateTo('player');
}
async function openSeriesPage(folder, eps, name, isYt) {
  let p = $('seriesPage');
  if (!p) { p = document.createElement('div'); p.id = 'seriesPage'; document.body.appendChild(p); }
  const hist = (e) => historyCache[e.relPath] || historyCache[e.fullPath];
  const done = eps.filter((e) => (Number(hist(e) && hist(e).percent) || 0) >= 85).length;
  const start = pickSeriesStart(eps);
  const started = !!hist(start.ep) && (start.time > 0 || done > 0);
  const ep = start.ep, parts = epCardParts(ep);
  p.innerHTML = `
    <div class="sp-hero"><div class="sp-cover" id="spCover"></div><div class="sp-fade"></div>
      <button class="sp-back" id="spBack" aria-label="Back"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <div class="sp-head"><h2>${escapeHtml(name)}</h2><div class="sp-chips" id="spChips"><span>${eps.length} ${eps.length === 1 ? 'video' : 'episodes'}</span><span>${done}/${eps.length} watched</span></div></div>
    </div>
    <div class="sp-body">
      <div class="sp-actions"><button class="sp-play" id="spPlay"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20"/></svg><span>${started ? 'Resume' : 'Play'} ${escapeHtml(parts.tag || '')}</span></button></div>
      <p class="sp-syn" id="spSyn"></p>
      <h4 class="sub-h">Episodes</h4>
      <div class="sp-eps" id="spEps"></div>
    </div>`;
  $('spBack').onclick = closeSeriesPage;
  $('spPlay').onclick = () => playFromSeries(folder, eps, ep, start.time);
  const list = $('spEps');
  eps.forEach((e) => {
    const h = hist(e), pct = Math.min(100, Number(h && h.percent) || 0), pr = epCardParts(e);
    const row = document.createElement('button'); row.type = 'button'; row.className = 'sp-ep' + (pct >= 85 ? ' done' : '');
    row.innerHTML = `<span class="sp-th"></span><span class="sp-tx"><b>${escapeHtml(pr.tag || pr.title)}</b><small>${escapeHtml(pr.tag ? pr.title : '')}${pr.tag && e.size ? ' \u00b7 ' : ''}${escapeHtml(e.size || '')}${pct >= 85 ? ' \u00b7 \u2713 Watched' : pct > 0 ? ' \u00b7 ' + pct + '%' : ''}</small><i class="sp-bar"><u style="width:${pct}%"></u></i></span>`;
    row.onclick = () => playFromSeries(folder, eps, e, resumeStartTime(h || {}));
    list.appendChild(row);
    const th = row.querySelector('.sp-th'); th.classList.add('sp-ph'); th.dataset.ph = pr.tag || (cleanMediaTitle(e.name || '').trim()[0] || '\u25b6').toUpperCase();
    attachThumb(th, e.relPath || e.fullPath, 'episode', e.name);
  });
  p.classList.add('open'); p.scrollTop = 0; document.documentElement.classList.add('series-open');
  attachThumb($('spCover'), eps[0].relPath || eps[0].fullPath, 'series', folder);
  $('spCover').classList.add('sp-cover-el');
  if (prefs.networkMode === 'online' && !isYt) {
    const meta = await fetchOnlineArtwork(folder);
    if (meta && p.classList.contains('open')) {
      if (meta.localUrl) { const c = $('spCover'); c.classList.remove('text-cover'); c.style.backgroundImage = `url("${meta.localUrl}")`; c.classList.add('has-img'); }
      const inf = meta.info || {}, chips = $('spChips');
      if (inf.score > 0) chips.insertAdjacentHTML('afterbegin', `<span class="sp-score">\u2605 ${Number(inf.score).toFixed(1)}</span>`);
      if (inf.year) chips.insertAdjacentHTML('beforeend', `<span>${inf.year}</span>`);
      (inf.genres || []).slice(0, 3).forEach((g) => chips.insertAdjacentHTML('beforeend', `<span>${escapeHtml(g)}</span>`));
      if (meta.synopsis) { const sn = $('spSyn'); sn.textContent = meta.synopsis; sn.onclick = () => sn.classList.toggle('open'); sn.classList.add('has'); }
    }
  }
}


/* ===== Home screen shortcuts and widget entry points ===== */
window.astraGo = function (where) {
  if (where === 'files') { navigateTo('files'); return true; }
  if (where === 'tasks') { navigateTo('tasks'); return true; }
  if (where === 'resume') {
    if (!sessionRestoreDone) return false;
    const keys = Object.keys(historyCache || {}).sort((a, b) => (historyCache[b].updated || 0) - (historyCache[a].updated || 0));
    const k = keys[0];
    if (!k) { navigateTo('home'); return true; }
    const it = historyCache[k];
    loadQueueFor(k, it.name);
    inspectMediaAndPlay(it.name, k, resumeStartTime(it));
    navigateTo('player');
    return true;
  }
  return false;
};
/* "Open with Astra Player" from a file manager: play that file */
window.astraOpenFile = function (path) {
  if (!sessionRestoreDone) return false;
  const name = String(path).split('/').pop();
  try { loadQueueFor(path, name); } catch (e) {}
  inspectMediaAndPlay(name, path, 0);
  navigateTo('player');
  return true;
};
document.querySelectorAll('#goShortcuts [data-go]').forEach((b) => b.addEventListener('click', () => {
  if (window.AstraNative && AstraNative.pinGo) AstraNative.pinGo(b.dataset.label, b.dataset.go); else showToast('Only available in the app', 2500);
}));


/* ===== Cast to TV over DLNA (app) ===== */
(function initDlna() {
  const list = $('dlnaList'), scan = $('btnDlnaScan'), now = $('dlnaNow'), txt = $('dlnaTxt'), pp = $('dlnaPP'), stop = $('dlnaStop');
  if (!list || !scan) return;
  let casting = null, poll = null, paused = false;
  const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json());
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function paint(st) {
    if (!casting) { now.style.display = 'none'; return; }
    now.style.display = 'flex';
    txt.textContent = `Casting to ${casting}` + (st && st.dur ? ` \u00b7 ${mmss(st.pos)} / ${mmss(st.dur)}` : '');
    pp.textContent = paused ? 'Play' : 'Pause';
  }
  function endCast(seekLocal) {
    clearInterval(poll); poll = null; casting = null; paint();
    if (seekLocal > 0) { try { video.currentTime = seekLocal; } catch (e) {} }
  }
  scan.onclick = async () => {
    list.textContent = 'Looking for TVs (about 4 seconds)...';
    try {
      const d = await fetch('/api/cast/devices', { cache: 'no-store' }).then((r) => r.json());
      const devs = d.devices || [];
      if (!devs.length) { list.innerHTML = '<span style="color:var(--muted)">No TV found. Check the Wi-Fi and that the TV allows media/DLNA casting. Chromecast is not supported yet.</span>'; return; }
      list.innerHTML = '';
      devs.forEach((dv) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--surface-2);padding:7px 10px;border-radius:8px;border:1px solid var(--line);';
        row.innerHTML = `<b style="color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(dv.name)}</b><button type="button" class="pill-btn highlight mini">Cast</button>`;
        row.querySelector('button').onclick = async () => {
          if (!activeVideoPath) return showToast('Open a video first', 2200);
          const t = Math.floor(video.currentTime || 0);
          showToast('Sending to ' + dv.name + '...', 2000);
          const r = await post('/api/cast/play', { dev: dv.id, file: activeVideoPath, title: (currentVideoList.find(isActiveItem) || {}).name || 'Video', time: t }).catch(() => ({ ok: false }));
          if (!r.ok) return showToast(r.error || 'Could not cast', 3500, 'err');
          video.pause(); casting = r.name; paused = false; paint();
          clearInterval(poll);
          poll = setInterval(async () => {
            const st = await fetch('/api/cast/status', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
            if (!st || !st.active) return endCast(0);
            paused = st.state === 'PAUSED_PLAYBACK'; paint(st);
            if (st.state === 'STOPPED' && st.pos > 5) endCast(st.pos);
          }, 3000);
        };
        list.appendChild(row);
      });
    } catch (e) { list.textContent = 'Scan failed'; }
  };
  pp.onclick = async () => { await post('/api/cast/ctl', { action: paused ? 'play' : 'pause' }); paused = !paused; paint(); };
  stop.onclick = async () => {
    const st = await fetch('/api/cast/status').then((x) => x.json()).catch(() => null);
    await post('/api/cast/ctl', { action: 'stop' });
    endCast(st && st.pos > 0 ? st.pos : 0);
    showToast('Stopped casting. Continue on the phone', 2200);
  };
})();


/* ===== Which AI model makes the subtitles ===== */
function curEngineKey() {
  if (aiUi.online.checked) return '';
  try { const p = localStorage.getItem('astra_ai_engine') || ''; return /^whisper-/.test(p) ? p : ''; } catch (e) { return ''; }
}
function curFallbackKey() {
  try { const v = localStorage.getItem('astra_ai_fallback') || ''; return v; } catch (e) { return ''; }
}
(function initEngine() {
  const TXT = {
    vosk: 'Runs on this phone, no internet. Pick the language under Download offline models.',
    whisper: 'Whisper runs on this phone, no internet. More accurate than Vosk and can translate to English, but slower. Needs the model downloaded.',
    online: 'Sends the audio to your online service (your API key). Usually the most accurate. Needs internet.'
  };
  let caps = { whisper: false }, installed = {};
  async function load() {
    try { caps = await fetch('/api/ai/capabilities').then((r) => r.json()); } catch (e) {}
    try { const m = await fetch('/api/ai/models').then((r) => r.json()); installed = {}; (m.models || m || []).forEach((x) => { if (x && x.key) installed[x.key] = !!x.installed; }); } catch (e) {}
    sync();
  }
  function sync() {
    const on = aiUi.online, cfg = !on.disabled;
    let pref = ''; try { pref = localStorage.getItem('astra_ai_engine') || ''; } catch (e) {}
    const cur = on.checked && cfg ? 'online' : (/^whisper-/.test(pref) && caps.whisper && installed[pref] ? pref : 'vosk');
    const wl = (k, n) => `<option value="${k}"${caps.whisper && installed[k] ? '' : ' disabled'}>Offline \u00b7 ${n}${!caps.whisper ? ' (not in this build)' : installed[k] ? '' : ' (download first)'}</option>`;
    [$('aiEngine'), $('engineSel')].forEach((s) => {
      if (!s) return;
      s.innerHTML = '<option value="vosk">Offline \u00b7 Vosk (fast, basic)</option>' + wl('whisper-tiny', 'Whisper Tiny') + wl('whisper-base', 'Whisper Base')
        + '<option value="online"' + (cfg ? '' : ' disabled') + '>Online \u00b7 your API key' + (cfg ? '' : ' (add a key first)') + '</option>';
      s.value = cur;
    });
    const fb = curFallbackKey();
    const wl2 = (k, n) => `<option value="${k}"${caps.whisper && installed[k] ? '' : ' disabled'}>Backup \u00b7 ${n}${!caps.whisper ? ' (not in this build)' : installed[k] ? '' : ' (download first)'}</option>`;
    [$('aiEngine2'), $('engineSel2')].forEach((s) => {
      if (!s) return;
      s.innerHTML = '<option value="">Backup model: none</option><option value="vosk">Backup \u00b7 Offline Vosk</option>' + wl2('whisper-tiny', 'Whisper Tiny') + wl2('whisper-base', 'Whisper Base')
        + '<option value="online"' + (cfg ? '' : ' disabled') + '>Backup \u00b7 Online (your API key)</option>';
      s.value = [...s.options].some((o) => o.value === fb && !o.disabled) ? fb : '';
    });
    const txt = TXT[cur === 'online' ? 'online' : /^whisper/.test(cur) ? 'whisper' : 'vosk'];
    const n = $('engineNote'); if (n) n.textContent = txt;
    if (aiUi.hint) aiUi.hint.textContent = txt;
  }
  window.astraSyncEngine = sync;
  [$('aiEngine'), $('engineSel')].forEach((s) => {
    if (!s) return;
    s.addEventListener('change', () => {
      const v = s.value;
      try { localStorage.setItem('astra_ai_engine', v); } catch (e) {}
      aiUi.online.checked = v === 'online';
      aiUi.online.dispatchEvent(new Event('change'));
      sync();
    });
  });
  [$('aiEngine2'), $('engineSel2')].forEach((s) => {
    if (!s) return;
    s.addEventListener('change', () => { try { localStorage.setItem('astra_ai_fallback', s.value); } catch (e) {} sync(); showToast(s.value ? 'Backup model saved: used if the first one fails' : 'Backup model: none', 2200); });
  });
  window.astraEngineReload = load;
  load();
})();


/* ===== Battery warnings as toasts (app) ===== */
(function initBatteryToast() {
  let last = 0;
  function check(why) {
    try {
      if (!(window.AstraNative && AstraNative.batteryInfo)) return;
      if (Date.now() - last < 30 * 60 * 1000) return;
      const b = JSON.parse(AstraNative.batteryInfo() || '{}');
      if (b.saver) { last = Date.now(); showToast({ title: 'Battery saver is on', sub: 'Android can slow or stop AI tasks while it is on' }, 6000, 'warn'); }
      else if (b.ignoring === false && why === 'task') { last = Date.now(); showToast({ title: 'Battery optimization is on', sub: 'Tasks may stop when the screen is off. Settings > General > Battery' }, 6500, 'warn'); }
    } catch (e) {}
  }
  setTimeout(() => check('start'), 6000);
  window.astraBatteryCheck = check;
})();

// on/off switches: put the I / O marks inside every switch
function rockerMarks(root) {
  (root || document).querySelectorAll('label.switch > span:not(.rk-done), i.tgl:not(.rk-done)').forEach((s) => {
    s.classList.add('rk-done');
    s.insertAdjacentHTML('afterbegin', '<b class="rk">I</b><b class="rk">O</b>');
  });
}
rockerMarks();
new MutationObserver(() => rockerMarks()).observe(document.body, { childList: true, subtree: true });
