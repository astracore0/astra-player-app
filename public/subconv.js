/* Subtitle converters (ASS/SRT -> WebVTT cues). Same code the server uses; the Android app runs it in the page. */
(function () {
/* ------------------------------------------------------------------ */
function cleanAndDedupeVTT(rawVtt) {
  const lines = String(rawVtt).replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const result = ['WEBVTT', ''];
  const seenCues = new Set();
  let cue = null;

  const pushCue = () => {
    if (!cue) return;
    const text = cue.text.trim();
    if (text) {
      const key = `${cue.time}_${text}`;
      if (!seenCues.has(key)) {
        seenCues.add(key);
        result.push(cue.time, text, '');
      }
    }
    cue = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { pushCue(); continue; }           // blank line ends a cue
    if (line.includes('-->')) {                   // timing line starts a cue
      pushCue();
      cue = { time: line, text: '' };
      continue;
    }
    if (!cue) continue;                           // header, cue id, NOTE/STYLE blocks

    const cleanText = line
      .replace(/\{\\an8\}/gi, '<position:top>')
      .replace(/\{\\an[1-9]\}/gi, '')
      .replace(/\{[^}]*\}/g, '')
      .replace(/\\[Nn]/g, ' ')
      .replace(/\\h/g, ' ')
      .trim();

    if (cleanText) cue.text += (cue.text ? ' ' : '') + cleanText;
  }
  pushCue();

  return result.join('\n');
}
/* ffmpeg's own WebVTT output drops ASS/SRT alignment tags ({\an8}), so top-positioned lines
   (signs, second speaker) would pile up at the bottom. Extracting as ASS and converting here
   keeps the position (as the <position:top> marker the player understands), italics and bold. */
function assTimeToVtt(t) {
  const m = /^(\d+):(\d{2}):(\d{2})[.,](\d{1,3})/.exec(String(t).trim());
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}:${m[3]}.${m[4].padEnd(3, '0')}`;
}

/* ASS colour (&HAABBGGRR or &HBBGGRR&) -> 'rrggbb' */
function assColor(v) {
  const m = /&?H?([0-9a-f]{6,8})&?/i.exec(String(v || '').trim());
  if (!m) return '';
  const h = m[1].slice(-6);
  return h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2);
}

/* ---- ASS override-tag engine (v1.17): turns one Dialogue line into a compact JSON description
   that the player draws itself (positions, fades, moves, \t animation, karaoke, vector drawings). ---- */
const ASS_TAG_RE = /\\(?:(pos|move|org|fade|fad|clip|iclip)\(([^)]*)\)|(1c|2c|3c|4c|1a|2a|3a|4a|alpha|an|fscx|fscy|fsp|frz|frx|fry|fax|fay|fr|fs|fn|bord|xbord|ybord|shad|xshad|yshad|blur|be|kf|ko|kt|k|K|pbo|p|b|i|u|s|q|a|c|r|fe)([^\\}]*))/g;
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const alphaOf = (v) => { const m = /([0-9a-f]{2})/i.exec(String(v || '')); return m ? +(1 - parseInt(m[1], 16) / 255).toFixed(3) : 1; };

function assDrawing(src, scale) {
  const k = 1 / Math.pow(2, Math.max(1, scale) - 1);
  const tk = String(src).trim().split(/\s+/);
  let d = '', cmd = '', pts = [], cur = null, minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const P = (x, y) => { x *= k; y *= k; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; return [x, y]; };
  const f2 = (n) => +n.toFixed(2);
  const flush = () => {
    if (!pts.length) return;
    if (cmd === 'm' || cmd === 'n') { cur = pts[pts.length - 1]; d += `${d && cmd === 'm' ? 'Z ' : ''}M${f2(cur[0])} ${f2(cur[1])} `; }
    else if (cmd === 'l') { pts.forEach((p) => { d += `L${f2(p[0])} ${f2(p[1])} `; cur = p; }); }
    else if (cmd === 'b') { for (let i = 0; i + 2 < pts.length; i += 3) { d += `C${pts.slice(i, i + 3).map((p) => `${f2(p[0])} ${f2(p[1])}`).join(' ')} `; cur = pts[i + 2]; } }
    else if (cmd === 's' && cur) {
      const q = [cur, ...pts]; if (q.length >= 4) {
        for (let i = 0; i + 3 < q.length; i++) {
          const [a, b, c, e] = [q[i], q[i + 1], q[i + 2], q[i + 3]];
          for (let s = 1; s <= 6; s++) {
            const t = s / 6, t2 = t * t, t3 = t2 * t;
            const w0 = (1 - t) ** 3 / 6, w1 = (3 * t3 - 6 * t2 + 4) / 6, w2 = (-3 * t3 + 3 * t2 + 3 * t + 1) / 6, w3 = t3 / 6;
            d += `L${f2(w0 * a[0] + w1 * b[0] + w2 * c[0] + w3 * e[0])} ${f2(w0 * a[1] + w1 * b[1] + w2 * c[1] + w3 * e[1])} `;
          }
        }
      }
    }
    pts = [];
  };
  for (let i = 0; i < tk.length; i++) {
    const w = tk[i].toLowerCase();
    if (/^[mnlbspc]$/.test(w)) { flush(); cmd = w; continue; }
    if (/^-?[\d.]+$/.test(w) && /^-?[\d.]+$/.test(tk[i + 1] || '')) { pts.push(P(+w, +tk[i + 1])); i++; }
  }
  flush();
  if (!d || minX > maxX) return null;
  return { d: d.trim() + ' Z', x: f2(minX), y: f2(minY), w: f2(Math.max(0.5, maxX - minX)), h: f2(Math.max(0.5, maxY - minY)) };
}

/* returns null for a plain line (normal text rendering is fine) or {info, plain} for one that needs the engine */
function assCueInfo(text, st, ev, res, durMs, ff) {
  const sb = { c1: st.c1 || 'ffffff', fs: st.fs || 0, fn: st.fn || '' };
  const fsK = ff ? 0.4 : 1;   // SRT <font size> is in video pixels (~720p); ffmpeg's 384x288 canvas needs it scaled
  const base = {
    fs: st.fs || 0, c1: st.c1 || 'ffffff', c2: st.c2 || '', c3: st.c3 || '000000', fn: st.fn || '',
    b: st.b ? 1 : 0, i: st.i ? 1 : 0, u: st.u ? 1 : 0, s: st.s ? 1 : 0,
    bord: st.bord == null ? 2 : st.bord, shad: st.shad || 0, blur: 0, sx: st.sx || 100, sy: st.sy || 100, frz: st.ang || 0, a: 1
  };
  let cur = { ...base };
  const g = { an: st.an || 2 };
  const tf = [];
  const runs = [];
  let special = false, drawing = null, pMode = 0, pbo = 0, kAcc = 0, kNext = null, kStarted = false;
  const diff = (c) => { const o = {}; for (const k of ['c1', 'fs', 'b', 'i', 'u', 's', 'fn', 'bord']) if (c[k] !== base[k]) o[k] = c[k]; return o; };
  const parts = text.split(/(\{[^}]*\})/);
  let first = true;

  for (const part of parts) {
    if (part.startsWith('{') && part.endsWith('}')) {
      const body = part.slice(1, -1);
      const apply = (o, tag, val) => {
        switch (tag) {
          case 'c': case '1c': o.c1 = String(val).trim() ? (assColor(val) || o.c1) : sb.c1; break;
          case '2c': o.c2 = assColor(val) || o.c2; break;
          case '3c': o.c3 = assColor(val) || o.c3; break;
          case 'alpha': case '1a': o.a = alphaOf(val); break;
          case 'fs': o.fs = String(val).trim() ? num(val, o.fs) * fsK : sb.fs; break;
          case 'fscx': o.sx = num(val, 100); break;
          case 'fscy': o.sy = num(val, 100); break;
          case 'frz': case 'fr': o.frz = num(val); break;
          case 'bord': o.bord = num(val); break;
          case 'shad': o.shad = num(val); break;
          case 'blur': case 'be': o.blur = num(val); break;
          default: break;
        }
      };
      const noT = body.replace(/\\t\(((?:[^()]|\([^()]*\))*)\)/g, (m, inner) => {
        const a = inner.split(',');
        let t1 = 0, t2 = durMs, acc = 1, tags = inner;
        const nums = [];
        while (a.length && /^\s*-?[\d.]+\s*$/.test(a[0]) && nums.length < 3) nums.push(num(a.shift()));
        tags = a.join(',');
        if (nums.length === 1) acc = nums[0]; else if (nums.length === 2) { t1 = nums[0]; t2 = nums[1]; } else if (nums.length === 3) { t1 = nums[0]; t2 = nums[1]; acc = nums[2]; }
        const p = {}; let mm; const re = new RegExp(ASS_TAG_RE.source, 'g');
        while ((mm = re.exec(tags))) if (mm[3]) apply(p, mm[3], mm[4]);
        if (Object.keys(p).length) { tf.push({ t1, t2, acc, p }); special = true; }
        return '';
      });
      let m; const re = new RegExp(ASS_TAG_RE.source, 'g');
      while ((m = re.exec(noT))) {
        if (m[1]) {
          const a = m[2].split(',').map((x) => x.trim());
          if (m[1] === 'pos' && a.length >= 2) { g.pos = [num(a[0]), num(a[1])]; special = true; }
          else if (m[1] === 'move' && a.length >= 4) { g.mv = [num(a[0]), num(a[1]), num(a[2]), num(a[3]), a[4] != null ? num(a[4]) : 0, a[5] != null ? num(a[5]) : durMs]; special = true; }
          else if (m[1] === 'fad' && a.length >= 2) { const i1 = num(a[0]), o1 = num(a[1]); g.fd = [[0, 0], [i1, 1], [Math.max(i1, durMs - o1), 1], [durMs, 0]]; special = true; }
          else if (m[1] === 'fade' && a.length >= 7) {
            const [a1, a2, a3, t1, t2, t3, t4] = a.map((x) => num(x));
            const op = (x) => +(1 - x / 255).toFixed(3);
            g.fd = [[0, op(a1)], [t1, op(a1)], [t2, op(a2)], [t3, op(a2)], [t4, op(a3)], [durMs, op(a3)]]; special = true;
          } else if (m[1] === 'clip' || m[1] === 'iclip') { /* clip rectangles are not drawn */ }
          continue;
        }
        const tag = m[3], val = m[4];
        if (tag === 'an') { g.an = Math.min(9, Math.max(1, num(val, 2))); }
        else if (tag === 'a') { const v = num(val, 2); g.an = ({ 1: 1, 2: 2, 3: 3, 5: 7, 6: 8, 7: 9, 9: 4, 10: 5, 11: 6 })[v] || 2; }
        else if (tag === 'b') { cur.b = num(val, 0) ? 1 : 0; if (/^[1-9]\d\d/.test(val)) cur.b = parseInt(val, 10) >= 600 ? 1 : 0; }
        else if (tag === 'i') cur.i = num(val, 0) ? 1 : 0;
        else if (tag === 'u') cur.u = num(val, 0) ? 1 : 0;
        else if (tag === 's') cur.s = num(val, 0) ? 1 : 0;
        else if (tag === 'fn') { cur.fn = val.trim() || sb.fn; special = true; }
        else if (tag === 'r') { cur = { ...base }; if (val && /^\S/.test(val)) { /* named style reset not resolved */ } }
        else if (tag === 'p') { pMode = num(val, 0); if (pMode > 0) special = true; }
        else if (tag === 'pbo') pbo = num(val);
        else if (tag === 'k' || tag === 'K' || tag === 'kf' || tag === 'ko') { kNext = { d: num(val) * 10, type: tag === 'k' ? 'k' : tag === 'ko' ? 'k' : 'f' }; special = true; }
        else if (tag === 'kt') kAcc = num(val) * 10;
        else if (/^(c|1c|2c|3c|alpha|1a|fs|fscx|fscy|frz|fr|bord|shad|blur|be)$/.test(tag)) {
          apply(cur, tag, val);
          if (tag === 'c' || tag === '1c' || tag === 'fs') special = true;
          if (/^(fscx|fscy|frz|fr|blur|be)$/.test(tag)) special = true;
        }
        else if (/^(frx|fry|fax|fay)$/.test(tag)) special = true;
      }
      if (first && !runs.length) Object.assign(base, { c1: cur.c1, c2: cur.c2, c3: cur.c3, fs: cur.fs, fn: cur.fn, b: cur.b, i: cur.i, u: cur.u, s: cur.s, bord: cur.bord, shad: cur.shad, blur: cur.blur, sx: cur.sx, sy: cur.sy, frz: cur.frz, a: cur.a });
      continue;
    }
    if (!part) continue;
    first = false;
    if (pMode > 0) { const dr = assDrawing(part, pMode); if (dr) { dr.pbo = pbo; dr.c = cur.c1; dr.o = cur.c3; dr.bord = cur.bord; drawing = dr; } continue; }
    const t = part.replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' ');
    if (!t) continue;
    const run = { t, ...diff(cur) };
    if (kNext) { run.k = [kAcc, kNext.d, kNext.type]; kAcc += kNext.d; kNext = null; kStarted = true; }
    else if (kStarted) run.k = [kAcc, 0, 'k'];
    runs.push(run);
  }
  if (g.an !== 2 && g.an !== 8) special = true;
  if (!special) return null;
  const plain = runs.map((r) => r.t).join('').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain && !drawing) return null;
  const mr = [ev.ml || st.ml || 0, ev.mr || st.mr || 0, Math.max(ev.mv || st.mv || 0, ff ? res[1] * 0.07 : 0)];
  const info = { r: res, an: g.an, base, mr };
  if (st.bs === 3) info.box = 1;
  if (g.pos) info.pos = g.pos;
  if (g.mv) info.mv = g.mv;
  if (g.fd) info.fd = g.fd;
  if (tf.length) info.tf = tf;
  if (drawing) info.dr = drawing;
  else info.runs = runs;
  return { info, plain };
}

function assToVtt(raw) {
  const lines = String(raw).replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const styles = new Map();
  let section = '';
  let styleFmt = [];
  let evFmt = [];
  let resX = 0, resY = 0;
  const cues = [];

  for (const line of lines) {
    const sec = /^\[(.+)\]\s*$/.exec(line.trim());
    if (sec) { section = sec[1].toLowerCase(); continue; }

    if (section === 'script info') {
      const m = /^PlayRes([XY])\s*:\s*(\d+)/i.exec(line.trim());
      if (m) { if (m[1].toUpperCase() === 'X') resX = Number(m[2]); else resY = Number(m[2]); }
    } else if (section.includes('styles')) {
      if (/^format:/i.test(line)) {
        styleFmt = line.slice(7).split(',').map((x) => x.trim().toLowerCase());
      } else if (/^style:/i.test(line) && styleFmt.length) {
        const f = line.slice(6).split(',');
        const name = (f[styleFmt.indexOf('name')] || '').trim();
        const align = parseInt(f[styleFmt.indexOf('alignment')], 10);
        if (name) {
          const g = (k) => f[styleFmt.indexOf(k)];
          styles.set(name, {
            top: align >= 7 && align <= 9, an: align || 2,
            fs: parseFloat(g('fontsize')) || 0, fn: (g('fontname') || '').trim(),
            c1: assColor(g('primarycolour')), c2: assColor(g('secondarycolour')), c3: assColor(g('outlinecolour')),
            b: parseInt(g('bold'), 10) !== 0 && g('bold') != null && String(g('bold')).trim() !== '0', i: String(g('italic')).trim() !== '0' && g('italic') != null,
            u: String(g('underline')).trim() !== '0' && g('underline') != null, s: String(g('strikeout')).trim() !== '0' && g('strikeout') != null,
            sx: parseFloat(g('scalex')) || 100, sy: parseFloat(g('scaley')) || 100, ang: parseFloat(g('angle')) || 0,
            bs: parseInt(g('borderstyle'), 10) || 1, bord: parseFloat(g('outline')), shad: parseFloat(g('shadow')) || 0,
            ml: parseInt(g('marginl'), 10) || 0, mr: parseInt(g('marginr'), 10) || 0, mv: parseInt(g('marginv'), 10) || 0
          });
        }
      }
    } else if (section === 'events') {
      if (/^format:/i.test(line)) {
        evFmt = line.slice(7).split(',').map((x) => x.trim().toLowerCase());
      } else if (/^dialogue:/i.test(line) && evFmt.length) {
        const parts = line.slice(9).split(',');
        const textIdx = evFmt.indexOf('text');
        if (textIdx === -1 || parts.length <= textIdx) continue;
        const text = parts.slice(textIdx).join(',');
        const start = assTimeToVtt(parts[evFmt.indexOf('start')]);
        const end = assTimeToVtt(parts[evFmt.indexOf('end')]);
        if (!start || !end) continue;

        const styleName = (parts[evFmt.indexOf('style')] || '').trim().replace(/^\*/, '');
        const st = styles.get(styleName) || {};
        const anMatch = /\{[^}]*\\an([1-9])/.exec(text);
        const an = anMatch ? Number(anMatch[1]) : (st.an || 2);
        const top = anMatch ? Number(anMatch[1]) >= 7 : !!st.top;

        const clean = text
          .replace(/\{[^}]*\\i1[^}]*\}/g, '<i>')
          .replace(/\{[^}]*\\i0[^}]*\}/g, '</i>')
          .replace(/\{[^}]*\\b1[^}]*\}/g, '<b>')
          .replace(/\{[^}]*\\b0[^}]*\}/g, '</b>')
          .replace(/\{[^}]*\\u1[^}]*\}/g, '<u>')
          .replace(/\{[^}]*\\u0[^}]*\}/g, '</u>')
          .replace(/\{[^}]*\}/g, '')
          .replace(/\\[Nn]/g, ' ')
          .replace(/\\h/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const toMs = (v) => { const m = /^(\d+):(\d\d):(\d\d)\.(\d+)/.exec(v); return m ? ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4] : 0; };
        const evx = { ml: parseInt(parts[evFmt.indexOf('marginl')], 10) || 0, mr: parseInt(parts[evFmt.indexOf('marginr')], 10) || 0, mv: parseInt(parts[evFmt.indexOf('marginv')], 10) || 0 };
        if (!/\\p[1-9]/.test(text) && /^\s*m\s+-?[\d.]+\s+-?[\d.]+\s+[lbcs]\s/i.test(text.replace(/\{[^}]*\}/g, ""))) continue;   // drawing leaked into plain text
        let ci = null;
        try { ci = assCueInfo(text, st, evx, [resX || 384, resY || 288], Math.max(1, toMs(end) - toMs(start)), /Script generated by FFmpeg/.test(raw)); } catch (_) { ci = null; }
        if (ci) {
          const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(ci.info)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          cues.push({ start, end, text: '<ass:' + b64 + '>' + (ci.plain || '\u200b') });
          continue;
        }
        if (!clean || /^m\s+-?[\d.]+\s+-?[\d.]+\s+[lbcs]\s/i.test(clean)) continue;   // a drawing that leaked into plain text
        cues.push({ start, end, text: (top ? '<position:top>' : '') + clean });
      }
    }
  }

  cues.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  // outline + fill layers of the same line (converted ASS) show as one: keep the last layer
  const lastOf = new Map();
  cues.forEach((c, i) => { const p = c.text.replace(/^<[a-z]+:[^>]*>/i, ''); if (p.replace(/\s/g, '').length > 3) lastOf.set(`${c.start}|${c.end}|${p}`, i); });
  const keep = cues.filter((c, i) => { const p = c.text.replace(/^<[a-z]+:[^>]*>/i, ''); return p.replace(/\s/g, '').length <= 3 || lastOf.get(`${c.start}|${c.end}|${p}`) === i; });
  cues.length = 0; cues.push(...keep);
  return 'WEBVTT\n\n' + cues.map((c) => `${c.start} --> ${c.end}\n${c.text}\n`).join('\n');
}

/* Read an .srt ourselves (ffmpeg merges cues that start together, which wrecks syllable-by-syllable files)
   and turn it into ASS text so <font face/size/color>, <b>/<i>/<u> and {\an8} reach the same engine. */
function srtToAss(raw) {
  const out = ['[Script Info]', '; Script generated by FFmpeg/Lavc (Astra SRT reader)', 'ScriptType: v4.00+', 'PlayResX: 384', 'PlayResY: 288', '',
    '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Default,Arial,16,&Hffffff,&Hffffff,&H0,&H0,0,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1', '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'];
  const blocks = String(raw).replace(/^\uFEFF/, '').split(/\r?\n\r?\n+/);
  const T = (h, m, sec, ms) => `${+h}:${m}:${sec}.${String(ms).padEnd(3, '0').slice(0, 2)}`;
  for (const b of blocks) {
    const lines = b.split(/\r?\n/);
    const ti = lines.findIndex((l) => /-->/.test(l));
    if (ti < 0) continue;
    const m = /(\d+):(\d\d):(\d\d)[,.](\d+)\s*-->\s*(\d+):(\d\d):(\d\d)[,.](\d+)/.exec(lines[ti]);
    if (!m) continue;
    const stack = [{ fn: '', fs: '', c: '' }];
    const top = () => stack[stack.length - 1];
    const col = (v) => { const h = /^#?([0-9a-f]{6})$/i.exec(String(v).trim()); return h ? '&H' + h[1].slice(4, 6) + h[1].slice(2, 4) + h[1].slice(0, 2) + '&' : ''; };
    let text = lines.slice(ti + 1).join('\\N').replace(/<(\/?)(font|b|i|u|s)\b([^>]*)>/gi, (all, close, tag, attrs) => {
      tag = tag.toLowerCase();
      if (tag !== 'font') return `{\\${tag}${close ? 0 : 1}}`;
      if (close) { if (stack.length > 1) stack.pop(); const t = top(); return `{\\fn${t.fn}}{\\fs${t.fs}}{\\c${t.c}}`; }
      const n = { ...top() }; let o = '';
      const face = /face\s*=\s*["']?([^"'>]+?)["']?(?=\s+\w+=|\s*$)/i.exec(attrs), size = /size\s*=\s*["']?(\d+)/i.exec(attrs), color = /color\s*=\s*["']?(#?[0-9a-f]{6})/i.exec(attrs);
      if (face) { n.fn = face[1].trim(); o += `{\\fn${n.fn}}`; }
      if (size) { n.fs = size[1]; o += `{\\fs${n.fs}}`; }
      if (color && col(color[1])) { n.c = col(color[1]); o += `{\\c${n.c}}`; }
      stack.push(n); return o;
    }).replace(/<[^>]+>/g, '');
    out.push(`Dialogue: 0,${T(m[1], m[2], m[3], m[4])},${T(m[5], m[6], m[7], m[8])},Default,,0,0,0,,${text}`);
  }
  return out.join('\n');
}

window.astraSubConv = { cleanAndDedupeVTT: cleanAndDedupeVTT, assToVtt: assToVtt, srtToAss: srtToAss };
})();
