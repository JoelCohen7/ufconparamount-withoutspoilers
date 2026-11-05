// ==UserScript==
// @name         Paramount+ Without Spoilers
// @namespace    joel.paramountplus.nospoilers
// @version      0.5.2
// @description  Hides durations and time remaining on UFC, Dana White's Contender Series and LFA replays on Paramount+ (everything else is left alone). Adds ±10 s / 30 s / 1 min / 5 min jumps and a fixed-scale seek bar with thumbnails. Works on computers and on iPhone/iPad (Safari + Userscripts).
// @match        https://www.paramountplus.com/*
// @homepageURL  https://github.com/JoelCohen7/ufconparamount-withoutspoilers
// @updateURL    https://raw.githubusercontent.com/JoelCohen7/ufconparamount-withoutspoilers/ios/ufconparamount-withoutspoilers.user.js
// @downloadURL  https://raw.githubusercontent.com/JoelCohen7/ufconparamount-withoutspoilers/ios/ufconparamount-withoutspoilers.user.js
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if (window.__ppns) return;
  window.__ppns = true;

  // ---------- Settings ----------
  const WINDOWS_MIN = [15, 30, 60, 90, 120];          // possible bar scales (minutes); click the scale label to cycle
  const DEFAULT_WINDOW_MIN = 90;
  const JUMPS = [-300, -60, -30, -10, 10, 30, 60, 300];
  const LS_WIN = 'ppns:windowMin';
  const LS_SHOWTIME = 'ppns:showElapsed';

  const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let windowSec = (WINDOWS_MIN.includes(lsGet(LS_WIN, DEFAULT_WINDOW_MIN)) ? lsGet(LS_WIN, DEFAULT_WINDOW_MIN) : DEFAULT_WINDOW_MIN) * 60;
  let showElapsed = lsGet(LS_SHOWTIME, true);

  // ---------- 0) Only UFC, Dana White's Contender Series and LFA replays ----------
  // Other shows, movies and live events are left exactly as Paramount+ shows them.
  const FIGHT_TEXT = /\b(ufc|lfa|legacy fighting|contender series)\b/i;
  const FIGHT_SLUG = /^(ufc|lfa|legacy-fighting|dana-white-contender-series)/i;
  const CARD = '.swiper-slide, article, .episode, .grid-view-item, li';

  // The series of the video on this page (from the page's own analytics data or its og:title), or null if not known yet.
  function seriesName() {
    const u = window.utag_data;
    if (u && (u.showSeriesTitle || u.show)) return u.showSeriesTitle || u.show;
    const og = document.querySelector('meta[property="og:title"]');
    return og && og.content ? og.content : null;
  }
  // 'fight' = the whole page is fight content, 'other' = it isn't, 'mixed' = decide card by card (home, my list, search...)
  function pageScope() {
    const path = location.pathname;
    if (/^\/(?:[a-z]{2}\/)?(shows|movies)\/video\//.test(path)) {
      const series = seriesName();
      return series === null || FIGHT_TEXT.test(series) ? 'fight' : 'other';   // unknown yet: hide first
    }
    const m = /^\/(?:[a-z]{2}\/)?shows\/([^/]+)/.exec(path);
    if (m) return FIGHT_SLUG.test(m[1]) ? 'fight' : 'other';
    return 'mixed';
  }
  function isLive() {
    const u = window.utag_data;
    if (u && u.isDcrLive === true) return true;
    if (/\/live-tv\//.test(location.pathname)) return true;
    const v = getVideo();
    return !!(v && v.duration === Infinity);
  }
  let scope = pageScope();
  // Our player (panel, hidden bar, clicks, keys) only runs on fight replays.
  function playerActive() {
    return scope === 'fight' && /\/video\//.test(location.pathname) && !isLive();
  }
  function isFightCard(card) {
    const bits = [card.innerText || ''];
    card.querySelectorAll('img[alt]').forEach((i) => bits.push(i.alt));
    card.querySelectorAll('[aa-link]').forEach((a) => bits.push(a.getAttribute('aa-link')));
    if (FIGHT_TEXT.test(bits.join(' | '))) return true;
    return [...card.querySelectorAll('a[href^="/shows/"]')].some((a) => FIGHT_SLUG.test(a.getAttribute('href').split('/')[2] || ''));
  }
  function inScope(el) {
    if (scope === 'fight') return true;
    if (scope === 'other') return false;
    const card = el.closest(CARD);
    if (!card) return false;
    if (card.classList.contains('ppns-fightcard')) return true;
    if (!isFightCard(card)) return false;
    card.classList.add('ppns-fightcard');
    return true;
  }

  // ---------- 1) Hide everything that shows a duration ----------
  const css = `
    html.ppns-player .aa-player-skin .controls-time-wrapper,
    html.ppns-player .aa-player-skin .seek-bar,
    html.ppns-player .aa-player-skin .time-tip-plus-placeholder,
    html.ppns-player .aa-player-skin .seek-bar-admarkers,
    html.ppns-on .video__metadata span.duration,
    html.ppns-on .episode-progress-bar-wrapper,
    html.ppns-on .info-wrapper .progress-bar,
    html.ppns-on .thumb-wrapper .progress-bar,
    .ppns-fightcard .episode-progress-bar-wrapper,
    .ppns-fightcard .progress-bar,
    .ppns-hidden-time { display: none !important; }

    #ppns-panel { width: 100%; padding: 0 24px 6px; box-sizing: border-box; position: relative; z-index: 5;
      font: 14px/1.2 "Proxima Nova", Arial, sans-serif; color: #fff; user-select: none; }
    #ppns-panel * { box-sizing: border-box; }
    .ppns-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    #ppns-panel .ppns-btn { display: inline-block !important; background: rgba(255,255,255,.12) !important; border: 1px solid rgba(255,255,255,.25) !important;
      color: #fff !important; border-radius: 4px !important; padding: 5px 10px !important; cursor: pointer; font: inherit !important; min-width: 50px; }
    #ppns-panel .ppns-btn:hover { background: rgba(0,100,255,.85) !important; border-color: #0064ff !important; }
    .ppns-spacer { flex: 1; }
    .ppns-elapsed { font-variant-numeric: tabular-nums; min-width: 64px; text-align: right; cursor: pointer; opacity: .9; }
    .ppns-barwrap { display: flex; align-items: center; gap: 8px; margin: 8px 0 2px; }
    .ppns-edge { font-variant-numeric: tabular-nums; opacity: .75; min-width: 52px; text-align: center; }
    .ppns-scale { cursor: pointer; text-decoration: underline dotted; }
    #ppns-panel .ppns-page { display: inline-block !important; background: none !important; border: none !important; color: #fff !important; cursor: pointer; font-size: 18px !important; padding: 0 4px !important; opacity: .8; }
    .ppns-page:hover { opacity: 1; }
    .ppns-bar { position: relative; flex: 1; height: 20px; cursor: pointer; touch-action: none; }
    .ppns-track { position: absolute; left: 0; right: 0; top: 8px; height: 4px; background: rgba(255,255,255,.3); border-radius: 2px; }
    .ppns-bar:hover .ppns-track { top: 7px; height: 6px; }
    .ppns-fill { position: absolute; left: 0; top: 0; bottom: 0; background: #0064ff; border-radius: 2px; }
    .ppns-knob { position: absolute; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: #0064ff; }
    .ppns-ticks { position: absolute; inset: 0; pointer-events: none; }
    .ppns-tick { position: absolute; top: 6px; bottom: 6px; width: 1px; background: rgba(255,255,255,.35); }
    .ppns-tip { position: absolute; bottom: 28px; transform: translateX(-50%); display: none; pointer-events: none;
      background: #000; border: 2px solid #fff; border-radius: 4px; overflow: hidden; text-align: center; }
    .ppns-tip .ppns-img { width: 240px; height: 135px; background-repeat: no-repeat; }
    .ppns-tip .ppns-noimg { width: 240px; height: 135px; display: flex; align-items: center; justify-content: center; opacity: .6; }
    .ppns-tip span { display: block; padding: 3px 0; font-variant-numeric: tabular-nums; }
    .ppns-toast { position: absolute; left: 50%; top: 40%; transform: translate(-50%,-50%); z-index: 50; pointer-events: none;
      background: rgba(0,0,0,.65); color: #fff; font: 600 28px/1 Arial, sans-serif; padding: 14px 22px; border-radius: 8px;
      opacity: 0; transition: opacity .25s; }
    .ppns-toast.on { opacity: 1; transition: none; }
    /* Pausing with a click / Space doesn't bring up the controls (moving the mouse does) */
    html.ppns-hideui .aa-player-skin .controls-manager,
    html.ppns-hideui .aa-player-skin .top-menu-manager,
    html.ppns-hideui .aa-player-skin .controls-backplane,
    html.ppns-hideui .aa-player-skin .top-menu-backplane,
    html.ppns-hideui .aa-player-skin .metadata-manager,
    html.ppns-hideui .top-menu-hint,
    html.ppns-hideui .aa-player-skin .skin-metadata-manager-content { opacity: 0 !important; pointer-events: none !important; transition: none !important; }
    .ppns-bezel { position: absolute; left: 50%; top: 50%; width: 76px; height: 76px; margin: -38px 0 0 -38px; border-radius: 50%;
      background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; z-index: 60; }
    .ppns-bezel.on { animation: ppns-bezel .55s ease-out forwards; }
    @keyframes ppns-bezel { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(1.6); } }
    .ppns-speed { position: absolute; top: 72px; left: 50%; transform: translateX(-50%); display: none; align-items: center; gap: 6px;
      background: rgba(0,0,0,.6); color: #fff; font: 600 16px/1 Arial, sans-serif; padding: 8px 14px; border-radius: 18px; pointer-events: none; z-index: 60; }
    .ppns-speed.on { display: flex; }
    /* Touch screens: the site's controls give way to our own overlay (its ⋯ button brings them back) */
    html.ppns-touch:not(.ppns-siteui) .aa-player-skin .controls-manager,
    html.ppns-touch:not(.ppns-siteui) .aa-player-skin .top-menu-manager,
    html.ppns-touch:not(.ppns-siteui) .aa-player-skin .controls-backplane,
    html.ppns-touch:not(.ppns-siteui) .aa-player-skin .top-menu-backplane,
    html.ppns-touch:not(.ppns-siteui) .aa-player-skin .metadata-manager,
    html.ppns-touch:not(.ppns-siteui) .top-menu-hint,
    html.ppns-touch:not(.ppns-siteui) .aa-player-skin .skin-metadata-manager-content { opacity: 0 !important; pointer-events: none !important; }
  `;
  const addStyle = () => {
    if (document.getElementById('ppns-style')) return;
    const s = document.createElement('style');
    s.id = 'ppns-style';
    s.textContent = css;
    const parent = document.head || document.documentElement;
    if (parent) parent.appendChild(s);    // too early (no <html> yet): attach() adds it later
  };
  addStyle();

  // The player's own CSS wins over ours for some parts (it uses !important), so those get an inline !important too.
  const NATIVE_HIDE = ['.aa-player-skin .controls-time-wrapper', '.aa-player-skin .seek-bar',
    '.aa-player-skin .time-tip-plus-placeholder', '.aa-player-skin .seek-bar-admarkers'];
  const hideNative = (on) => {
    for (const sel of NATIVE_HIDE) {
      document.querySelectorAll(sel).forEach((el) => {
        if (on && el.style.getPropertyValue('display') !== 'none') {
          el.style.setProperty('display', 'none', 'important');
          el.dataset.ppnsHidden = '1';
        } else if (!on && el.dataset.ppnsHidden) {
          el.style.removeProperty('display');
          delete el.dataset.ppnsHidden;
        }
      });
    }
  };

  // Text that is only a duration ("21:19", "3H 23M", "21M") or a time left ("39m left") gets hidden.
  // "21M Jun 7, 2003" / "4H 2M 24 oct 2026" (duration glued to the date) lose the duration and keep the date.
  const DUR = '(\\d+\\s*(h|hr|hrs|m|min|mins|s|sec|secs)\\.?\\s*){1,3}';
  const TIME_RE = new RegExp('^\\s*(-?\\d{1,2}:\\d{2}(:\\d{2})?|' + DUR + ')\\s*$', 'i');
  const LEFT_RE = new RegExp('^\\s*((quedan|restan|faltan|restam)\\s+)?' + DUR + '\\s*(left|remaining|restantes?)?\\s*$', 'i');
  const LEFT_WORD = /\b(left|remaining|restantes?|quedan|restan|faltan|restam)\b/i;
  const LEAD_RE = /^(\s*)(?:\d+\s*H(?:\s*\d+\s*M)?|\d+\s*M)\s+(?=[A-Za-z]{3,}\.?\s+\d|\d{1,2}(?:\s+[A-Za-z]{3,}|[\/.-]\d))/i;
  const ours = (el) => el.closest('#ppns-panel, .ppns-toast, script, style');
  const stripped = new Map();   // text node -> original text, to put it back if the page turns out not to be fight content
  const checkText = (n) => {
    const el = n.parentElement;
    if (!el || ours(el)) return;
    const t = n.nodeValue;
    const dur = TIME_RE.test(t) || (LEFT_WORD.test(t) && LEFT_RE.test(t));
    if (!dur && !LEAD_RE.test(t)) return;
    if (!inScope(el)) return;
    if (dur) {
      el.classList.add('ppns-hidden-time');
    } else {
      stripped.set(n, t);
      n.nodeValue = t.replace(LEAD_RE, '$1');
    }
  };
  // Undo the hiding (used when a video page turns out to be another show).
  const unscrub = () => {
    document.querySelectorAll('.ppns-hidden-time').forEach((el) => el.classList.remove('ppns-hidden-time'));
    stripped.forEach((t, n) => { n.nodeValue = t; });
    stripped.clear();
  };
  const scrubText = (root) => {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) checkText(n);
  };

  // ---------- 2) Don't hand the duration to the OS / browser media controls ----------
  // On fight replays the site's calls are dropped; section 8 tells the OS a fake length instead.
  const origSetPositionState = (() => {
    try {
      const ms = navigator.mediaSession;
      return ms && ms.setPositionState ? ms.setPositionState.bind(ms) : null;
    } catch { return null; }
  })();
  try {
    if (origSetPositionState) {
      navigator.mediaSession.setPositionState = function (state) {
        if (!playerActive()) return origSetPositionState(state);
      };
    }
  } catch {}

  // ---------- 3) Thumbnails (tile sprites listed in the DASH manifest, or in an HLS image playlist) ----------
  // Long videos come split in Periods (the cuts are the ad breaks). Each Period has its own tile set: its tiles start
  // at the Period's own start and its last tile is only partly filled (the rest is black).
  // Safari (Mac, iPhone, iPad) gets HLS instead of DASH: there the tiles come from #EXT-X-IMAGE-STREAM-INF, if any.
  let thumbs = null;        // DASH: [{ start, end, base, media, id, firstTile, secsPerTile, cols, rows, secsPerThumb }]
                            // HLS:  [{ start, end, url, cols, rows, secsPerThumb }] (one per sprite)
  const seenMpd = new Set();

  const noteResource = (name) => {
    if (seenMpd.has(name)) return;
    if (/(\.mpd|\/mpd)(\?|$)/i.test(name)) {
      seenMpd.add(name);
      loadMpd(name);
    } else if (/\.m3u8(\?|$)/i.test(name)) {
      seenMpd.add(name);
      loadHls(name);
    }
  };
  try {
    new PerformanceObserver((list) => list.getEntries().forEach((e) => noteResource(e.name)))
      .observe({ type: 'resource', buffered: true });
  } catch {}
  try { performance.getEntriesByType('resource').forEach((e) => noteResource(e.name)); } catch {}

  // "PT1H14M40.27S" -> seconds
  const isoSecs = (v) => {
    const m = /^P(?:(\d+(?:\.\d+)?)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(v || '');
    return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : NaN;
  };
  const childBase = (el, parentBase) => {
    const b = [...el.children].find((c) => c.tagName === 'BaseURL');
    let u = b ? new URL(b.textContent.trim(), parentBase).href : parentBase;
    if (!u.endsWith('/')) u += '/';
    return u;
  };

  async function loadMpd(url) {
    try {
      const xml = new DOMParser().parseFromString(await (await fetch(url)).text(), 'application/xml');
      const root = xml.documentElement;
      const rootBase = childBase(root, url);
      const total = isoSecs(root.getAttribute('mediaPresentationDuration'));
      const sets = [];
      let cursor = 0;
      for (const period of [...root.getElementsByTagName('Period')]) {
        const start = period.getAttribute('start') ? isoSecs(period.getAttribute('start')) : cursor;
        const dur = isoSecs(period.getAttribute('duration'));
        const end = isFinite(dur) ? start + dur : total;
        cursor = end;
        const set = [...period.getElementsByTagName('AdaptationSet')]
          .find((a) => /image/.test(a.getAttribute('contentType') || '') || /image/.test(a.getAttribute('mimeType') || ''));
        if (!set) continue;
        const tpl = set.getElementsByTagName('SegmentTemplate')[0];
        const reps = [...set.getElementsByTagName('Representation')];
        const rep = reps.sort((a, b) => (+b.getAttribute('width') || 0) - (+a.getAttribute('width') || 0))
          .find((r) => (+r.getAttribute('width') || 0) <= 1400) || reps[0];
        if (!tpl || !rep) continue;
        const tileProp = [...rep.getElementsByTagName('EssentialProperty')]
          .find((p) => /thumbnail_tile/.test(p.getAttribute('schemeIdUri') || ''));
        const [cols, rows] = ((tileProp && tileProp.getAttribute('value')) || '1x1').split('x').map(Number);
        const secsPerTile = +tpl.getAttribute('duration') / +(tpl.getAttribute('timescale') || 1);
        sets.push({
          start, end, base: childBase(period, rootBase), media: tpl.getAttribute('media'), id: rep.getAttribute('id'),
          firstTile: +(tpl.getAttribute('startNumber') || 1), secsPerTile, cols, rows,
          secsPerThumb: secsPerTile / (cols * rows),
        });
      }
      if (sets.length) thumbs = sets;
    } catch {}
  }

  // HLS: master playlist -> image stream (#EXT-X-IMAGE-STREAM-INF) -> sprites with #EXT-X-TILES.
  const hlsAttrs = (line) => {
    const a = {};
    line.replace(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g, (_, k, v) => { a[k] = v.replace(/^"|"$/g, ''); });
    return a;
  };
  async function loadHls(url) {
    try {
      const text = await (await fetch(url)).text();
      if (!/^#EXTM3U/.test(text)) return;
      if (/#EXT-X-IMAGE-STREAM-INF/.test(text)) {
        const streams = text.split(/\r?\n/).filter((l) => l.startsWith('#EXT-X-IMAGE-STREAM-INF:')).map(hlsAttrs)
          .filter((a) => a.URI).map((a) => ({ uri: a.URI, w: +String(a.RESOLUTION || '0x0').split('x')[0] || 0 }));
        streams.sort((a, b) => b.w - a.w);
        const pick = streams.find((x) => x.w <= 1400) || streams[0];
        if (pick) {
          const u = new URL(pick.uri, url).href;
          if (!seenMpd.has(u)) { seenMpd.add(u); loadHls(u); }
        }
        return;
      }
      if (!/#EXT-X-IMAGES-ONLY|#EXT-X-TILES/.test(text)) return;
      const sets = [];
      let t = 0, dur = 0, tiles = null;
      for (const line of text.split(/\r?\n/)) {
        if (line.startsWith('#EXTINF:')) dur = parseFloat(line.slice(8)) || 0;
        else if (line.startsWith('#EXT-X-TILES:')) tiles = hlsAttrs(line.slice(13));
        else if (line && !line.startsWith('#')) {
          const [cols, rows] = String((tiles && tiles.LAYOUT) || '1x1').split('x').map(Number);
          const per = tiles && +tiles.DURATION ? +tiles.DURATION : dur / ((cols * rows) || 1);
          sets.push({ start: t, end: t + dur, url: new URL(line, url).href, cols: cols || 1, rows: rows || 1, secsPerThumb: per });
          t += dur;
          dur = 0;
          tiles = null;
        }
      }
      if (sets.length) thumbs = sets;
    } catch {}
  }
  // With Safari's own HLS playback the page never fetches the playlist itself: read it from the video's address.
  const checkVideoSrc = (v) => {
    const src = v && v.currentSrc;
    if (src && /^https?:/.test(src) && !thumbs) noteResource(src);
  };

  // Background (url + position) that shows the thumbnail for second t, or null.
  function thumbAt(t) {
    if (!thumbs || t < 0) return null;
    const p = thumbs.find((x) => t >= x.start && t < x.end);
    if (!p || !(p.secsPerThumb > 0)) return null;
    if (p.url) {
      const idx = Math.min(p.cols * p.rows - 1, Math.floor((t - p.start) / p.secsPerThumb));
      const col = idx % p.cols, row = Math.floor(idx / p.cols);
      return {
        image: `url("${p.url}")`,
        size: `${p.cols * 100}% ${p.rows * 100}%`,
        pos: `${p.cols > 1 ? (col / (p.cols - 1)) * 100 : 0}% ${p.rows > 1 ? (row / (p.rows - 1)) * 100 : 0}%`,
      };
    }
    const local = t - p.start;
    const tile = Math.floor(local / p.secsPerTile);
    const idx = Math.floor((local - tile * p.secsPerTile) / p.secsPerThumb);
    const col = idx % p.cols, row = Math.floor(idx / p.cols);
    const url = p.base + p.media.replace('$RepresentationID$', p.id).replace('$Number$', p.firstTile + tile);
    return {
      image: `url("${url}")`,
      size: `${p.cols * 100}% ${p.rows * 100}%`,
      pos: `${p.cols > 1 ? (col / (p.cols - 1)) * 100 : 0}% ${p.rows > 1 ? (row / (p.rows - 1)) * 100 : 0}%`,
    };
  }

  // ---------- 4) Our own panel ----------
  const fmt = (s) => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
  };
  const jumpLabel = (j) => (j < 0 ? '\u2212' : '+') + (Math.abs(j) >= 60 ? Math.abs(j) / 60 + ' min' : Math.abs(j) + ' s');

  let video = null;
  let panel = null;
  let manualPage = null;    // null = the current time decides the page
  let toastTimer = null;

  // The content video is the longest one in the player (ads play in other <video> elements).
  const getVideo = () => {
    const vids = [...document.querySelectorAll('.player-wrapper video, video')];
    let best = null;
    for (const v of vids) {
      const d = isFinite(v.duration) ? v.duration : 0;
      if (!best || d > (isFinite(best.duration) ? best.duration : 0)) best = v;
    }
    return best;
  };
  const curPage = () => (manualPage !== null ? manualPage : Math.floor((video ? video.currentTime : 0) / windowSec));

  function seekTo(t) {
    if (!video) return;
    let target = Math.max(0, t);
    if (isFinite(video.duration) && target > video.duration - 1) target = Math.max(0, video.duration - 1);
    video.currentTime = target;
    manualPage = null;
  }

  function toast(text) {
    const host = document.querySelector('.aa-player-skin') || document.body;
    let el = host.querySelector(':scope > .ppns-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ppns-toast';
      host.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 650);
  }

  function jump(sec) {
    if (!video) return;
    seekTo(video.currentTime + sec);
    toast(jumpLabel(sec));
  }

  function buildPanel() {
    const p = document.createElement('div');
    p.id = 'ppns-panel';
    p.innerHTML = `
      <div class="ppns-row">
        ${JUMPS.map((j) => `<button class="ppns-btn" data-jump="${j}">${jumpLabel(j)}</button>`).join('')}
        <span class="ppns-spacer"></span>
        <span class="ppns-elapsed" title="Elapsed time (click or T to show/hide)"></span>
      </div>
      <div class="ppns-barwrap">
        <button class="ppns-page" data-page="-1" title="Previous window">&lsaquo;</button>
        <span class="ppns-edge ppns-edge-l"></span>
        <div class="ppns-bar">
          <div class="ppns-track"><div class="ppns-fill"></div></div>
          <div class="ppns-ticks"></div>
          <div class="ppns-knob"></div>
          <div class="ppns-tip"><div class="ppns-img"></div><div class="ppns-noimg">no preview</div><span></span></div>
        </div>
        <span class="ppns-edge ppns-edge-r"></span>
        <button class="ppns-page" data-page="1" title="Next window">&rsaquo;</button>
        <span class="ppns-edge ppns-scale" title="Bar scale (click to change)"></span>
      </div>`;

    // Keep panel clicks away from the player (it would pause)
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'touchstart', 'touchend'].forEach((ev) =>
      p.addEventListener(ev, (e) => e.stopPropagation()));

    p.querySelectorAll('[data-jump]').forEach((b) =>
      b.addEventListener('click', () => jump(+b.dataset.jump)));
    p.querySelectorAll('[data-page]').forEach((b) =>
      b.addEventListener('click', () => { manualPage = Math.max(0, curPage() + +b.dataset.page); render(); }));
    p.querySelector('.ppns-scale').addEventListener('click', () => {
      const i = WINDOWS_MIN.indexOf(windowSec / 60);
      windowSec = WINDOWS_MIN[(i + 1) % WINDOWS_MIN.length] * 60;
      lsSet(LS_WIN, windowSec / 60);
      manualPage = null;
      render();
    });
    p.querySelector('.ppns-elapsed').addEventListener('click', () => toggleElapsed());

    // Mouse: the thumbnail follows the pointer and dragging scrubs the video.
    // Finger (iPhone/iPad): dragging only previews; releasing jumps there.
    const bar = p.querySelector('.ppns-bar');
    const timeAtX = (clientX) => {
      const r = bar.getBoundingClientRect();
      return (curPage() + Math.min(1, Math.max(0, (clientX - r.left) / r.width))) * windowSec;
    };
    let drag = null;               // { type, page } while a button/finger is down
    bar.addEventListener('pointermove', (e) => {
      const t = timeAtX(e.clientX);
      showTip(t);
      if (drag && drag.type === 'mouse') { seekTo(t); manualPage = drag.page; }
    });
    bar.addEventListener('pointerleave', () => { if (!drag) hideTip(); });
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { type: e.pointerType, page: curPage() };   // the window doesn't change while dragging
      try { bar.setPointerCapture(e.pointerId); } catch {}
      const t = timeAtX(e.clientX);
      showTip(t);
      if (drag.type === 'mouse') { seekTo(t); manualPage = drag.page; }
    });
    const endDrag = (e, commit) => {
      if (!drag) return;
      const touch = drag.type !== 'mouse';
      drag = null;
      manualPage = null;
      if (touch) {
        if (commit) seekTo(timeAtX(e.clientX));
        hideTip();
      }
      render();
    };
    bar.addEventListener('pointerup', (e) => endDrag(e, true));
    bar.addEventListener('pointercancel', (e) => endDrag(e, false));
    return p;
  }

  // Thumbnail and timestamp above the bar for second t.
  function showTip(t) {
    if (!panel) return;
    const tip = panel.querySelector('.ppns-tip');
    const img = tip.querySelector('.ppns-img');
    const noImg = tip.querySelector('.ppns-noimg');
    const th = thumbAt(t);
    // Past the end there is no tile: same rule as Fight Pass, "no preview".
    const past = video && isFinite(video.duration) && t > video.duration;
    if (th && !past) {
      img.style.backgroundImage = th.image;
      img.style.backgroundSize = th.size;
      img.style.backgroundPosition = th.pos;
      img.style.display = '';
      noImg.style.display = 'none';
    } else {
      img.style.display = 'none';
      noImg.style.display = '';
    }
    tip.querySelector('span').textContent = fmt(t);
    tip.style.display = 'block';
    // Keep the thumbnail on screen near the ends of the bar
    const bw = tip.parentNode.clientWidth;
    const half = tip.offsetWidth / 2;
    const x = Math.min(1, Math.max(0, t / windowSec - curPage())) * bw;
    tip.style.left = Math.min(Math.max(x, half - 40), bw - half + 40) + 'px';
  }
  function hideTip() {
    if (panel) panel.querySelector('.ppns-tip').style.display = 'none';
  }

  function render() {
    if (!panel || !video) return;
    const page = curPage();
    const from = page * windowSec;
    const f = Math.min(1, Math.max(0, (video.currentTime - from) / windowSec));
    const inPage = video.currentTime >= from && video.currentTime < from + windowSec;
    panel.querySelector('.ppns-fill').style.width = (inPage ? f * 100 : video.currentTime >= from + windowSec ? 100 : 0) + '%';
    const knob = panel.querySelector('.ppns-knob');
    knob.style.display = inPage ? '' : 'none';
    knob.style.left = f * 100 + '%';
    panel.querySelector('.ppns-edge-l').textContent = fmt(from);
    panel.querySelector('.ppns-edge-r').textContent = fmt(from + windowSec);
    panel.querySelector('.ppns-scale').textContent = windowSec / 60 + ' min';
    panel.querySelector('[data-page="-1"]').style.visibility = page > 0 ? '' : 'hidden';
    panel.querySelector('.ppns-elapsed').textContent = showElapsed ? fmt(video.currentTime) : '\u2022\u2022\u2022';
    // ticks every 15 min (every 5 on small scales)
    const ticks = panel.querySelector('.ppns-ticks');
    const step = windowSec > 1800 ? 900 : 300;
    const key = windowSec + ':' + step;
    if (ticks.dataset.key !== key) {
      ticks.dataset.key = key;
      ticks.innerHTML = '';
      for (let s = step; s < windowSec; s += step) {
        const t = document.createElement('div');
        t.className = 'ppns-tick';
        t.style.left = (s / windowSec) * 100 + '%';
        ticks.appendChild(t);
      }
    }
  }

  function toggleElapsed() {
    showElapsed = !showElapsed;
    lsSet(LS_SHOWTIME, showElapsed);
    render();
  }

  function attach() {
    addStyle();
    const prev = scope;
    scope = pageScope();
    if (prev !== scope && scope !== 'fight') unscrub();
    const active = playerActive();
    const root = document.documentElement;
    root.classList.toggle('ppns-on', scope === 'fight');
    root.classList.toggle('ppns-player', active);
    hideNative(active);
    if (!active) {
      if (panel && panel.parentNode) panel.remove();
      touchUpdate();
      return;
    }
    const v = getVideo();
    if (v !== video) {
      video = v;
      manualPage = null;
      if (video) {
        ['timeupdate', 'seeked', 'loadedmetadata', 'emptied', 'durationchange'].forEach((ev) => video.addEventListener(ev, render));
        video.addEventListener('loadedmetadata', () => checkVideoSrc(video));
        checkVideoSrc(video);
      }
    }
    document.querySelectorAll('video').forEach(watchVideo);
    // With a mouse the panel sits among the site's controls; on a touch screen, in our own overlay.
    const slot = touchSlot();
    const manager = document.querySelector('.aa-player-skin .controls-manager');
    if (slot && (!panel || panel.parentNode !== slot)) {
      panel = panel || buildPanel();
      slot.appendChild(panel);
      render();
    } else if (!slot && manager && (!panel || !manager.contains(panel))) {
      panel = panel || buildPanel();
      manager.insertBefore(panel, manager.querySelector('.controls-bottom'));
      render();
    }
  }

  // ---------- 5) Keyboard ----------
  // ←/→ 10 s · Shift 30 s · Ctrl 1 min · Ctrl+Shift 5 min · T shows/hides the elapsed time
  window.addEventListener('keydown', (e) => {
    if (!video || !document.querySelector('.aa-player-skin') || !playerActive()) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) && !(e.target.classList && e.target.classList.contains('seek-bar-range-input'))) return;
    if (e.target && e.target.isContentEditable) return;
    if (e.altKey || e.metaKey) return;
    let dir = 0;
    if (e.key === 'ArrowLeft') dir = -1;
    else if (e.key === 'ArrowRight') dir = 1;
    if (dir) {
      const amount = e.ctrlKey && e.shiftKey ? 300 : e.ctrlKey ? 60 : e.shiftKey ? 30 : 10;
      e.preventDefault();
      e.stopImmediatePropagation();
      jump(dir * amount);
      return;
    }
    if ((e.key === 't' || e.key === 'T') && !e.ctrlKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleElapsed();
    }
  }, true);

  const YT = {
    prefix: 'ppns-',
    host: '.aa-player-skin',
    // clicks on these keep their normal behavior
    exclude: '.controls-bottom, .top-menu-manager, #ppns-panel, .skip-button-wrapper, .panel-manager, .mylist-panel, ' +
      '.ad-info-manager, button, a, input',
    video: () => getVideo(),
    // not during ads (they play in another <video>)
    ready: () => {
      const ad = document.querySelector('.aa-player-skin .ad-info-manager');
      return playerActive() && !!getVideo() && !(ad && !ad.classList.contains('remove'));
    },
  };
  // ---------- 6) YouTube-style click: tap = play/pause with a brief icon, hold = 2x ----------
  // A short click (or Space/K) toggles play/pause, shows a quick icon in the middle and does NOT bring up the controls
  // (they come back when the mouse moves). Holding the button plays at 2x until it's released.
  const HOLD_MS = 350;
  const ICON_PLAY = '<svg viewBox="0 0 24 24" width="40" height="40"><path fill="#fff" d="M8 5v14l11-7z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="40" height="40"><path fill="#fff" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
  const ICON_FAST = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#fff" d="M4 6v12l8.5-6zm9 0v12l8.5-6z"/></svg>';
  let hold = null;          // { timer, active, prevRate, wasPaused }
  let swallow = false;      // the rest of an intercepted mouse press (up/click) must not reach the player
  let hideUiFrom = null;    // mouse position when the UI was hidden; moving away from it shows the controls again
  let lastMouse = null;

  const yt = (cls) => YT.prefix + cls;
  const ytHost = () => document.querySelector(YT.host);

  function hideUi() {
    document.documentElement.classList.add(yt('hideui'));
  }
  window.addEventListener('mousemove', (e) => {
    lastMouse = { x: e.clientX, y: e.clientY };
    if (!hideUiFrom) return;
    if (Math.abs(e.clientX - hideUiFrom.x) + Math.abs(e.clientY - hideUiFrom.y) > 4) {
      hideUiFrom = null;
      document.documentElement.classList.remove(yt('hideui'));
    }
  }, true);

  function bezel(svg) {
    const host = ytHost();
    if (!host) return null;
    let el = host.querySelector(':scope > .' + yt('bezel'));
    if (!el) {
      el = document.createElement('div');
      el.className = yt('bezel');
      host.appendChild(el);
    }
    el.innerHTML = svg;
    el.classList.remove('on');
    void el.offsetWidth;    // restart the animation
    el.classList.add('on');
    return el;
  }

  function speedBadge(show) {
    const host = ytHost();
    if (!host) return;
    let el = host.querySelector(':scope > .' + yt('speed'));
    if (!el) {
      el = document.createElement('div');
      el.className = yt('speed');
      el.innerHTML = '2x ' + ICON_FAST;
      host.appendChild(el);
    }
    el.classList.toggle('on', show);
  }

  function togglePlayback(pos) {
    const v = YT.video();
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
    hideUiFrom = pos || lastMouse || { x: -1e6, y: -1e6 };
    hideUi();
    bezel(v.paused ? ICON_PAUSE : ICON_PLAY);
  }

  function holdStart(pos) {
    const v = YT.video();
    if (!v) return;
    hold = { timer: setTimeout(() => {
      hold.active = true;
      hold.prevRate = v.playbackRate;
      hold.wasPaused = v.paused;
      v.playbackRate = 2;
      if (v.paused) v.play();
      hideUiFrom = pos || lastMouse || { x: -1e6, y: -1e6 };
      hideUi();
      speedBadge(true);
    }, HOLD_MS) };
  }
  // Returns true if the press was a hold (so it must not toggle).
  function holdEnd() {
    if (!hold) return false;
    clearTimeout(hold.timer);
    const h = hold;
    hold = null;
    if (!h.active) return false;
    const v = YT.video();
    if (v) {
      v.playbackRate = h.prevRate || 1;
      if (h.wasPaused) v.pause();
    }
    speedBadge(false);
    return true;
  }

  const onSurface = (e) => {
    const host = ytHost();
    return host && e.target instanceof Element && host.contains(e.target) && !e.target.closest(YT.exclude) && YT.ready();
  };

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !onSurface(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    swallow = true;
    holdStart({ x: e.clientX, y: e.clientY });
  }, true);
  ['mousedown', 'mouseup', 'click'].forEach((type) => window.addEventListener(type, (e) => {
    if (!swallow) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (type === 'click') swallow = false;
  }, true));
  window.addEventListener('pointerup', (e) => {
    if (!swallow || e.pointerType !== 'mouse') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!holdEnd()) togglePlayback({ x: e.clientX, y: e.clientY });
    setTimeout(() => { swallow = false; }, 0);   // in case no click event follows
  }, true);

  // Space / K behave the same: tap toggles, hold plays at 2x.
  const isPauseKey = (e) => (e.key === ' ' || e.key === 'k' || e.key === 'K') && !e.ctrlKey && !e.altKey && !e.metaKey;
  const typing = (e) => {
    const t = e.target;
    return t && ((/INPUT|TEXTAREA|SELECT/.test(t.tagName || '') && !(t.classList && t.classList.contains('seek-bar-range-input'))) || t.isContentEditable);
  };
  window.addEventListener('keydown', (e) => {
    if (!isPauseKey(e) || typing(e) || !ytHost() || !YT.ready()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat && !hold) holdStart(null);
  }, true);
  window.addEventListener('keyup', (e) => {
    if (!isPauseKey(e) || typing(e) || !ytHost() || !YT.ready()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!holdEnd()) togglePlayback(null);
  }, true);
  window.addEventListener('keypress', (e) => {
    if (isPauseKey(e) && !typing(e) && ytHost() && YT.ready()) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  const TL = {
    host: () => document.querySelector(YT.host),
    video: () => getVideo(),
    scope: () => playerActive(),    // fight replay page (also during its ads): Safari's own player must never show
    active: () => YT.ready(),       // fight replays only, and not during ads
    // taps here keep their normal behavior (simple controls / with the site's controls brought back)
    exclude: '.skip-button-wrapper, .panel-manager, .mylist-panel, .ad-info-manager',
    excludeSite: YT.exclude,
  };
  // ---------- 8) iPhone / iPad (touch screens) ----------
  // On a touch screen the player gets its own overlay instead of the site's controls (which are hidden):
  //   tap = show/hide the controls · double tap on the left/right third = −10/+10 s (keep tapping to add more)
  //   hold = 2x until you let go · ⛶ = full screen (on iPhone it fills the screen inside Safari, never Apple's player)
  //   ⋯ = bring back the site's own controls (settings, audio, etc.), still without times.
  // Safari's own full-screen player, Picture in Picture and AirPlay show the duration, so they are blocked.
  // (decided once the page exists: at document-start Safari can't answer media queries yet)
  let touchDevice = null;
  const TOUCH = () => {
    if (touchDevice === null && document.documentElement && document.body) {
      touchDevice = navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches;
    }
    return !!touchDevice;
  };
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const TAP_ZONE = 0.35;        // left/right share of the player width for double-tap jumps
  const DOUBLE_TAP_MS = 350;
  const STREAK_MS = 800;        // after a double tap, more taps on the same side keep adding 10 s
  const UI_HIDE_MS = 3500;

  const ICON_BACK = '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>';
  const ICON_MORE = '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4"/></svg>';
  const ICON_FS = '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z"/></svg>';
  const ICON_FS_EXIT = '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z"/></svg>';
  const ICON_BIG_PLAY = '<svg viewBox="0 0 24 24" width="60" height="60"><path fill="#fff" d="M8 5v14l11-7z"/></svg>';
  const ICON_BIG_PAUSE = '<svg viewBox="0 0 24 24" width="60" height="60"><path fill="#fff" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
  const skipIcon = (dir) => '<svg viewBox="0 0 24 24" width="44" height="44"><path fill="#fff" d="' + (dir < 0
    ? 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z'
    : 'M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z') +
    '"/><text x="12" y="16.3" text-anchor="middle" font-size="6.5" font-weight="700" font-family="Arial, sans-serif" fill="#fff">10</text></svg>';

  const touchCss = `
    #ppns-touch { position: absolute; inset: 0; z-index: 2147483647; display: none; pointer-events: none; color: #fff;
      font: 14px/1.2 -apple-system, "Helvetica Neue", Arial, sans-serif; -webkit-tap-highlight-color: transparent;
      -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    html.ppns-touch #ppns-touch { display: block; }
    html.ppns-touch .ppns-surface, html.ppns-touch .ppns-surface * { touch-action: pan-y; -webkit-user-select: none; user-select: none;
      -webkit-touch-callout: none; }
    html.ppns-touch [data-ppns-pfs], html.ppns-touch [data-ppns-pfs] * { touch-action: none; }
    html.ppns-touch #ppns-touch button, html.ppns-touch #ppns-touch .ppns-btn { touch-action: manipulation; }
    html.ppns-touch #ppns-touch .ppns-bar { touch-action: none; }
    #ppns-touch .ppns-t-layer { position: absolute; inset: 0; opacity: 0; transition: opacity .2s; pointer-events: none; }
    html.ppns-tui #ppns-touch .ppns-t-layer { opacity: 1; }
    html.ppns-tui #ppns-touch button, html.ppns-tui #ppns-touch .ppns-t-bot { pointer-events: auto; }
    #ppns-touch .ppns-t-shade { position: absolute; inset: 0;
      background: linear-gradient(rgba(0,0,0,.6), rgba(0,0,0,0) 25%, rgba(0,0,0,0) 55%, rgba(0,0,0,.75)); }
    #ppns-touch .ppns-t-top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center;
      padding: max(4px, env(safe-area-inset-top)) max(6px, env(safe-area-inset-right)) 0 max(6px, env(safe-area-inset-left)); }
    #ppns-touch .ppns-t-flex { flex: 1; }
    #ppns-touch .ppns-t-mid { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); display: flex;
      align-items: center; gap: min(12vw, 90px); }
    #ppns-touch .ppns-t-bot { position: absolute; left: 0; right: 0; bottom: 0;
      padding: 0 max(10px, env(safe-area-inset-right)) max(4px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)); }
    #ppns-touch button { background: none !important; border: 0 !important; margin: 0; padding: 8px !important; color: #fff;
      touch-action: manipulation; -webkit-appearance: none; appearance: none; cursor: pointer; line-height: 0; min-width: 0; }
    #ppns-touch button svg { display: block; filter: drop-shadow(0 0 3px rgba(0,0,0,.6)); }
    #ppns-touch button:active { opacity: .6; }
    #ppns-touch .ppns-t-play { padding: 4px !important; border-radius: 50%; }
    #ppns-touch #ppns-panel { position: static !important; width: auto !important; padding: 0 !important; margin: 0 !important; touch-action: none; }
    #ppns-touch #ppns-panel .ppns-row { flex-wrap: nowrap; gap: 4px; }
    #ppns-touch #ppns-panel .ppns-btn { flex: 1 1 0; min-width: 0 !important; padding: 8px 0 !important; font-size: 13px !important;
      line-height: 1 !important; text-align: center; white-space: nowrap; touch-action: manipulation; }
    #ppns-touch .ppns-elapsed { min-width: 58px; padding: 8px 0 8px 6px; }
    #ppns-touch .ppns-barwrap { margin: 2px 0 0; gap: 6px; }
    #ppns-touch .ppns-page { padding: 6px 8px !important; font-size: 22px !important; line-height: 1 !important; }
    #ppns-touch .ppns-edge { min-width: 44px; font-size: 12px; }
    #ppns-touch .ppns-scale { padding: 8px 0; }
    #ppns-touch .ppns-bar { height: 36px; }
    #ppns-touch .ppns-track, #ppns-touch .ppns-bar:hover .ppns-track { top: 16px; height: 4px; }
    #ppns-touch .ppns-knob { width: 16px; height: 16px; margin: -8px 0 0 -8px; }
    #ppns-touch .ppns-tick { top: 12px; bottom: 12px; }
    #ppns-touch .ppns-tip { bottom: 40px; }
    #ppns-touch .ppns-tip img, #ppns-touch .ppns-tip .ppns-img, #ppns-touch .ppns-tip .ppns-noimg { width: 200px; height: 112px; }
    /* iPhone upright: the small player only gets the bar (the jumps come back in full screen) */
    @media (max-width: 500px) {
      html:not(.ppns-pfs-on) #ppns-touch #ppns-panel .ppns-btn { display: none !important; }
      html:not(.ppns-pfs-on) #ppns-touch .ppns-elapsed { padding: 4px 0 0; }
      html.ppns-pfs-on #ppns-touch #ppns-panel .ppns-row { flex-wrap: wrap; }
      html.ppns-pfs-on #ppns-touch #ppns-panel .ppns-btn { flex: 1 1 22%; }
      html.ppns-pfs-on #ppns-touch .ppns-elapsed { flex: 1 1 100%; text-align: center; padding: 4px 0 0; }
      html.ppns-pfs-on #ppns-touch .ppns-t-bot { padding-bottom: max(24px, env(safe-area-inset-bottom)); }
    }
    /* Full screen inside the page (iPhone has no real full screen for anything but Safari's own player).
       Data attributes, not classes: React rewrites the class of its elements on every render. */
    [data-ppns-pfs] { position: fixed !important; left: 0 !important; top: 0 !important; right: 0 !important; bottom: 0 !important;
      width: 100vw !important; height: 100vh !important; height: 100dvh !important; max-width: none !important; max-height: none !important;
      min-height: 0 !important; margin: 0 !important; padding: 0 !important; z-index: 2147483600 !important; background: #000 !important;
      transform: none !important; border-radius: 0 !important; aspect-ratio: auto !important; }
    [data-ppns-pfs] video { object-fit: contain !important; }
    [data-ppns-pfs-anc] { transform: none !important; filter: none !important; contain: none !important; will-change: auto !important;
      perspective: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
      container-type: normal !important; z-index: 2147483600 !important; }
    html.ppns-pfs-on, html.ppns-pfs-on body { overflow: hidden !important; }
  `;
  const addTouchStyle = () => {
    if (document.getElementById('ppns-tstyle')) return;
    const s = document.createElement('style');
    s.id = 'ppns-tstyle';
    s.textContent = touchCss;
    (document.head || document.documentElement).appendChild(s);
  };

  let touchEl = null;
  // After one of our buttons acted, Safari's own click for that touch is dropped wherever it lands
  // (the layout may have changed under the finger, e.g. leaving full screen).
  let nativeClickOff = 0;
  window.addEventListener('click', (e) => {
    if (e.isTrusted && Date.now() < nativeClickOff) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  let uiOn = true;
  let uiTimer = null;
  let pfsOn = false;            // full screen inside the page wanted
  let pfsAuto = false;          // full screen entered by turning the iPhone sideways
  const touchOn = () => document.documentElement.classList.contains('ppns-touch');

  // The element that holds both the video and the controls (what goes full screen).
  function playerRoot() {
    const h = TL.host();
    const v = TL.video();
    if (!h) return null;
    let r = h;
    while (v && r && !r.contains(v)) r = r.parentElement;
    return r || h;
  }
  // Videos we look after: every video on the page (ads may play in their own <video>, outside the player).
  const owns = (v) => !!v && TL.scope();

  // Every video of the player: plays inside the page, no Picture in Picture, no AirPlay, no native controls.
  function prepVideo(v) {
    if (v.dataset.ppnsPrep) return;
    v.dataset.ppnsPrep = '1';
    try {
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.disablePictureInPicture = true;
      v.disableRemotePlayback = true;
      v.setAttribute('x-webkit-airplay', 'deny');
      v.setAttribute('disablepictureinpicture', '');
      v.setAttribute('disableremoteplayback', '');
    } catch {}
    if (TOUCH() || IOS) {
      new MutationObserver(() => { if (v.controls && owns(v)) v.controls = false; }).observe(v, { attributes: true, attributeFilter: ['controls'] });
      if (v.controls && owns(v)) v.controls = false;
    }
  }

  // ---- full screen ----
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fsApi = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const isFs = () => pfsOn || !!fsElement();

  // Puts the full-screen marks on the current player (or takes them off). Called again on every change of the page,
  // in case the site replaced the player's elements.
  function applyPfs() {
    const r = pfsOn ? playerRoot() : null;
    const anc = new Set();
    for (let a = r && r.parentElement; a && a !== document.documentElement; a = a.parentElement) anc.add(a);
    document.querySelectorAll('[data-ppns-pfs]').forEach((el) => { if (el !== r) el.removeAttribute('data-ppns-pfs'); });
    document.querySelectorAll('[data-ppns-pfs-anc]').forEach((el) => { if (!anc.has(el)) el.removeAttribute('data-ppns-pfs-anc'); });
    if (r && !r.hasAttribute('data-ppns-pfs')) r.setAttribute('data-ppns-pfs', '');
    anc.forEach((a) => { if (!a.hasAttribute('data-ppns-pfs-anc')) a.setAttribute('data-ppns-pfs-anc', ''); });
    document.documentElement.classList.toggle('ppns-pfs-on', !!r);
  }
  function enterPfs(r) {
    if (!r || pfsOn) return;
    pfsOn = true;
    pfsAuto = false;
    applyPfs();
    try { window.scrollTo(0, 0); } catch {}
    window.dispatchEvent(new Event('resize'));
    touchIcons();
  }
  function exitPfs() {
    if (!pfsOn) return;
    pfsOn = false;
    applyPfs();
    window.dispatchEvent(new Event('resize'));
    touchIcons();
  }
  function enterFs() {
    const r = playerRoot();
    if (!r) return;
    if (fsApi() && (r.requestFullscreen || r.webkitRequestFullscreen)) {
      try {
        const p = r.requestFullscreen ? r.requestFullscreen() : r.webkitRequestFullscreen();
        if (p && p.catch) p.catch(() => enterPfs(r));
        return;
      } catch {}
    }
    enterPfs(r);
  }
  function exitFs() {
    if (pfsOn) exitPfs();
    if (fsElement()) {
      try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {}
    }
  }
  const toggleFs = () => (isFs() ? exitFs() : enterFs());

  // iPhone turned sideways while watching: fill the screen, like the apps do; upright again: back to the page.
  const phoneLandscape = matchMedia('(orientation: landscape) and (max-height: 500px)');
  const onRotate = () => {
    if (!touchOn()) return;
    if (phoneLandscape.matches && !isFs()) {
      enterPfs(playerRoot());
      pfsAuto = true;
    } else if (!phoneLandscape.matches && pfsOn && pfsAuto) {
      exitPfs();
    }
  };
  try { phoneLandscape.addEventListener('change', onRotate); } catch { try { phoneLandscape.addListener(onRotate); } catch {} }

  if (IOS) {
    // The site asks Safari for its own full-screen player (or a full-screen <video>): give it ours instead.
    const VP = HTMLVideoElement.prototype;
    ['webkitEnterFullscreen', 'webkitEnterFullScreen', 'requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen'].forEach((name) => {
      const orig = VP[name];
      if (typeof orig !== 'function') return;
      try {
        VP[name] = function () {
          if (owns(this)) {
            enterFs();
            return name === 'requestFullscreen' ? Promise.resolve() : undefined;
          }
          return orig.apply(this, arguments);
        };
      } catch {}
    });
    // In case it gets there anyway: leave it at once and fill the screen with our player.
    document.addEventListener('webkitbeginfullscreen', (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement) || !owns(v)) return;
      try { v.webkitExitFullscreen(); } catch {}
      setTimeout(() => enterPfs(playerRoot()), 50);
    }, true);
    document.addEventListener('webkitpresentationmodechanged', (e) => {
      const v = e.target;
      if (v instanceof HTMLVideoElement && v.webkitPresentationMode && v.webkitPresentationMode !== 'inline' && owns(v)) {
        try { v.webkitSetPresentationMode('inline'); } catch {}
      }
    }, true);
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((type) => document.addEventListener(type, () => {
    const el = fsElement();
    if (el && el.tagName === 'VIDEO' && owns(el)) {
      exitFs();
      setTimeout(() => enterPfs(playerRoot()), 50);
    }
    touchIcons();
  }));

  // ---- overlay ----
  function buildTouch() {
    const t = document.createElement('div');
    t.id = 'ppns-touch';
    t.innerHTML = `
      <div class="ppns-t-layer">
        <div class="ppns-t-shade"></div>
        <div class="ppns-t-top">
          <button data-act="back" aria-label="Back">${ICON_BACK}</button>
          <span class="ppns-t-flex"></span>
          <button data-act="site" aria-label="Site controls">${ICON_MORE}</button>
          <button data-act="fs" aria-label="Full screen">${ICON_FS}</button>
        </div>
        <div class="ppns-t-mid">
          <button data-act="rw" aria-label="Back 10 seconds">${skipIcon(-1)}</button>
          <button data-act="play" class="ppns-t-play" aria-label="Play / pause">${ICON_BIG_PLAY}</button>
          <button data-act="fw" aria-label="Forward 10 seconds">${skipIcon(1)}</button>
        </div>
        <div class="ppns-t-bot"></div>
      </div>`;
    // Anything touched inside the overlay keeps it on screen, and never reaches the site's player.
    ['pointerdown', 'pointermove'].forEach((ev) => t.addEventListener(ev, (e) => { if (uiOn && e.pointerType !== 'mouse') setUi(true); }, true));
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'dblclick'].forEach((ev) =>
      t.addEventListener(ev, (e) => { if (e.target.closest('button, .ppns-t-bot')) e.stopPropagation(); }));
    // A finger on a button acts when it lifts, through a click of our own: the site may cancel the click Safari
    // would make from the touch. Safari's own click (if it still comes) is then ignored.
    const TAPPABLE = 'button, .ppns-scale, .ppns-elapsed';
    let pressed = null;
    t.addEventListener('pointerdown', (e) => {
      pressed = e.pointerType !== 'mouse' ? e.target.closest(TAPPABLE) : null;
    }, true);
    t.addEventListener('pointerup', (e) => {
      const el = pressed;
      pressed = null;
      if (!el || e.pointerType === 'mouse' || e.target.closest(TAPPABLE) !== el) return;
      nativeClickOff = Date.now() + 800;
      el.click();
    }, true);
    t.addEventListener('pointercancel', () => { pressed = null; }, true);

    t.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      const v = TL.video();
      switch (b.dataset.act) {
        case 'play': if (v) { if (v.paused) v.play(); else v.pause(); } break;
        case 'rw': jump(-10); break;
        case 'fw': jump(10); break;
        case 'fs': toggleFs(); break;
        case 'site': {
          const on = document.documentElement.classList.toggle('ppns-siteui');
          toast(on ? 'Site controls' : 'Simple controls');
          if (on) wakeSite();
          break;
        }
        case 'back': if (isFs()) exitFs(); else history.back(); break;
      }
      setUi(true);
    }));
    return t;
  }

  function wakeSite() {
    const h = TL.host();
    if (!h) return;
    const r = h.getBoundingClientRect();
    h.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  }

  function touchIcons() {
    if (!touchEl) return;
    const v = TL.video();
    const play = touchEl.querySelector('[data-act="play"]');
    const paused = !v || v.paused;
    if (play.dataset.state !== String(paused)) {
      play.dataset.state = String(paused);
      play.innerHTML = paused ? ICON_BIG_PLAY : ICON_BIG_PAUSE;
    }
    const fs = touchEl.querySelector('[data-act="fs"]');
    const full = isFs();
    if (fs.dataset.state !== String(full)) {
      fs.dataset.state = String(full);
      fs.innerHTML = full ? ICON_FS_EXIT : ICON_FS;
    }
  }

  // Shows (or hides) the overlay; while the video plays it hides itself after a few seconds.
  function setUi(on) {
    uiOn = on;
    document.documentElement.classList.toggle('ppns-tui', on);
    clearTimeout(uiTimer);
    const v = TL.video();
    if (on && v && !v.paused) uiTimer = setTimeout(() => { if (!tp) setUi(false); }, UI_HIDE_MS);
    if (on && document.documentElement.classList.contains('ppns-siteui')) wakeSite();
  }

  let touchVideo = null;
  function touchUpdate() {
    const on = TOUCH() && TL.active();
    if (pfsOn) {
      if (!TL.host()) exitPfs();      // left the player
      else applyPfs();
    }
    if (!on) {
      if (touchOn()) document.documentElement.classList.remove('ppns-touch');
      return;
    }
    addTouchStyle();
    const h = playerRoot();
    if (!touchEl) touchEl = buildTouch();
    // Always the last child: the site's own layers may sit at the same (maximum) z-index, and the last one wins.
    if (touchEl.parentNode !== h || h.lastElementChild !== touchEl) {
      if (getComputedStyle(h).position === 'static') h.style.position = 'relative';
      h.appendChild(touchEl);
      h.classList.add('ppns-surface');
    }
    if (!touchOn()) {
      document.documentElement.classList.add('ppns-touch');
      setUi(true);
      onRotate();
    }
    const v = TL.video();
    if (v && v !== touchVideo) {
      touchVideo = v;
      v.addEventListener('play', () => { touchIcons(); if (uiOn) setUi(true); });
      v.addEventListener('pause', () => { touchIcons(); setUi(true); });
    }
    touchIcons();
  }
  // Where the panel goes on a touch screen (null = in the site's controls, as with a mouse).
  function touchSlot() {
    touchUpdate();
    return touchOn() && touchEl ? touchEl.querySelector('.ppns-t-bot') : null;
  }
  if (navigator.maxTouchPoints > 0) setInterval(touchUpdate, 1000);

  // ---- gestures on the video ----
  let tp = null;            // finger down on the video: { id, x, y, moved, hold, timer }
  let tHold = null;         // { prevRate, wasPaused } while holding for 2x
  let lastTap = null;       // { t, zone }
  let streak = null;        // { dir, sum, t } double-tap jumps in a row
  let touchSwallow = 0;     // until then, the emulated mouse events / clicks of a touch don't reach the site

  const onTouchSurface = (e) => {
    if (!touchOn() || !(e.target instanceof Element)) return false;
    const h = TL.host();
    const r = playerRoot();
    if (!h || !r || !r.contains(e.target)) return false;
    if (e.target.closest('#ppns-touch button, #ppns-touch .ppns-t-bot')) return false;
    return !e.target.closest(document.documentElement.classList.contains('ppns-siteui') ? TL.excludeSite : TL.exclude);
  };
  const inOurUi = (el) => el instanceof Element && !!el.closest('#ppns-touch button, #ppns-touch .ppns-t-bot');
  const swallowEvent = (e) => {
    e.stopImmediatePropagation();
    if (e.cancelable) e.preventDefault();
  };

  function touchHoldStart() {
    const v = TL.video();
    if (!v) return;
    tHold = { prevRate: v.playbackRate, wasPaused: v.paused };
    v.playbackRate = 2;
    if (v.paused) v.play();
    speedBadge(true);
  }
  function touchHoldEnd() {
    if (!tHold) return;
    const v = TL.video();
    if (v) {
      v.playbackRate = tHold.prevRate || 1;
      if (tHold.wasPaused) v.pause();
    }
    tHold = null;
    speedBadge(false);
  }

  function onTap(x) {
    const h = TL.host();
    const r = h.getBoundingClientRect();
    const f = (x - r.left) / r.width;
    const zone = f < TAP_ZONE ? -1 : f > 1 - TAP_ZONE ? 1 : 0;
    const now = Date.now();
    const add = () => {
      streak.sum += 10;
      streak.t = now;
      if (video) seekTo(video.currentTime + zone * 10);
      toast((zone < 0 ? '−' : '+') + streak.sum + ' s');
    };
    if (zone && streak && streak.dir === zone && now - streak.t < STREAK_MS) return add();
    if (zone && lastTap && lastTap.zone === zone && now - lastTap.t < DOUBLE_TAP_MS) {
      setUi(false);            // like YouTube: no controls while jumping, so more taps don't land on buttons
      lastTap = null;
      streak = { dir: zone, sum: 0, t: now };
      return add();
    }
    streak = null;
    lastTap = { t: now, zone };
    setUi(!uiOn);
  }

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !onTouchSurface(e)) return;
    swallowEvent(e);
    touchSwallow = Date.now() + 1000;
    if (tp) return;
    tp = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, hold: false };
    tp.timer = setTimeout(() => {
      if (tp && !tp.moved) { tp.hold = true; touchHoldStart(); }
    }, HOLD_MS + 100);
  }, true);
  window.addEventListener('pointermove', (e) => {
    if (!tp || e.pointerId !== tp.id) return;
    swallowEvent(e);
    if (Math.abs(e.clientX - tp.x) + Math.abs(e.clientY - tp.y) > 14) {
      tp.moved = true;
      clearTimeout(tp.timer);
    }
  }, true);
  const fingerUp = (e, cancel) => {
    if (!tp || e.pointerId !== tp.id) return;
    swallowEvent(e);
    touchSwallow = Date.now() + 700;
    clearTimeout(tp.timer);
    const t = tp;
    tp = null;
    if (t.hold) { touchHoldEnd(); setUi(uiOn); return; }
    if (!cancel && !t.moved) onTap(e.clientX);
  };
  window.addEventListener('pointerup', (e) => fingerUp(e, false), true);
  window.addEventListener('pointercancel', (e) => fingerUp(e, true), true);
  // Outside full screen the page can still be scrolled with a finger on the video (touch-action: pan-y);
  // ending the touch is cancelled, so Safari doesn't turn it into a click for the site.
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((type) => window.addEventListener(type, (e) => {
    const r = playerRoot();
    if (inOurUi(e.target)) return;
    if (!(onTouchSurface(e) || (type !== 'touchstart' && (tp || Date.now() < touchSwallow) && r && r.contains(e.target)))) return;
    e.stopImmediatePropagation();
    if (e.cancelable && (pfsOn || type === 'touchend')) e.preventDefault();
  }, { capture: true, passive: false }));
  ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'].forEach((type) => window.addEventListener(type, (e) => {
    if (Date.now() < touchSwallow && onTouchSurface(e)) swallowEvent(e);
  }, true));

  // ---- the OS "Now Playing" controls (lock screen, Control Center) ----
  // They would show the real length, so they are told every video is 10 hours long.
  const FAKE_DURATION = 10 * 3600;
  let lastFake = 0;
  function fakePosition(force) {
    if (!origSetPositionState || !video || !TL.active()) return;
    const now = Date.now();
    if (!force && now - lastFake < 5000) return;
    lastFake = now;
    try {
      origSetPositionState({ duration: FAKE_DURATION, position: Math.min(FAKE_DURATION, Math.max(0, video.currentTime || 0)),
        playbackRate: video.playbackRate || 1 });
    } catch {}
  }
  const watchVideo = (v) => {
    prepVideo(v);
    if (v.dataset.ppnsFake) return;
    v.dataset.ppnsFake = '1';
    v.addEventListener('timeupdate', () => { if (v === video) fakePosition(false); });
    ['play', 'pause', 'seeked', 'ratechange', 'loadedmetadata'].forEach((ev) => v.addEventListener(ev, () => { if (v === video) fakePosition(true); }));
  };

  // ---------- Start ----------
  const start = () => {
    scrubText(document.body);
    attach();
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') {
          checkText(m.target);
        } else {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1) scrubText(n);
            else if (n.nodeType === 3) checkText(n);
          });
        }
      }
      attach();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
