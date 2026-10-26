// ==UserScript==
// @name         Paramount+ Without Spoilers
// @namespace    joel.paramountplus.nospoilers
// @version      0.4.0
// @description  Hides durations and time remaining on UFC, Dana White's Contender Series and LFA replays on Paramount+ (everything else is left alone). Adds ±10 s / 30 s / 1 min / 5 min jumps and a fixed-scale seek bar with thumbnails.
// @match        https://www.paramountplus.com/*
// @homepageURL  https://github.com/JoelCohen7/ufconparamount-withoutspoilers
// @updateURL    https://raw.githubusercontent.com/JoelCohen7/ufconparamount-withoutspoilers/main/ufconparamount-withoutspoilers.user.js
// @downloadURL  https://raw.githubusercontent.com/JoelCohen7/ufconparamount-withoutspoilers/main/ufconparamount-withoutspoilers.user.js
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
  `;
  const addStyle = () => {
    if (document.getElementById('ppns-style')) return;
    const s = document.createElement('style');
    s.id = 'ppns-style';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
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
  // "21M Jun 7, 2003" (duration glued to the date) loses the duration and keeps the date.
  const DUR = '(\\d+\\s*(h|hr|hrs|m|min|mins|s|sec|secs)\\.?\\s*){1,3}';
  const TIME_RE = new RegExp('^\\s*(-?\\d{1,2}:\\d{2}(:\\d{2})?|' + DUR + ')\\s*$', 'i');
  const LEFT_RE = new RegExp('^\\s*((quedan|restan|faltan|restam)\\s+)?' + DUR + '\\s*(left|remaining|restantes?)?\\s*$', 'i');
  const LEFT_WORD = /\b(left|remaining|restantes?|quedan|restan|faltan|restam)\b/i;
  const LEAD_RE = /^(\s*)(\d+\s*H\s*)?\d+\s*M\s+(?=[A-Z][a-z]{2}\s+\d)/;
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
  try {
    if (navigator.mediaSession && navigator.mediaSession.setPositionState) {
      const original = navigator.mediaSession.setPositionState.bind(navigator.mediaSession);
      navigator.mediaSession.setPositionState = function (state) {
        if (!playerActive()) return original(state);
      };
    }
  } catch {}

  // ---------- 3) Thumbnails (tile sprites listed in the DASH manifest) ----------
  // Long videos come split in Periods (the cuts are the ad breaks). Each Period has its own tile set: its tiles start
  // at the Period's own start and its last tile is only partly filled (the rest is black).
  let thumbs = null;        // [{ start, end, base, media, id, firstTile, secsPerTile, cols, rows, secsPerThumb }]
  const seenMpd = new Set();

  const noteResource = (name) => {
    if (/(\.mpd|\/mpd)(\?|$)/i.test(name) && !seenMpd.has(name)) {
      seenMpd.add(name);
      loadMpd(name);
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

  // Background (url + position) that shows the thumbnail for second t, or null.
  function thumbAt(t) {
    if (!thumbs || t < 0) return null;
    const p = thumbs.find((x) => t >= x.start && t < x.end);
    if (!p || !(p.secsPerThumb > 0)) return null;
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
    tip.style.left = Math.min(1, Math.max(0, t / windowSec - curPage())) * 100 + '%';
    tip.style.display = 'block';
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
      return;
    }
    const v = getVideo();
    if (v !== video) {
      video = v;
      manualPage = null;
      if (video) {
        try { video.disablePictureInPicture = true; } catch {}
        ['timeupdate', 'seeked', 'loadedmetadata', 'emptied', 'durationchange'].forEach((ev) => video.addEventListener(ev, render));
      }
    }
    const manager = document.querySelector('.aa-player-skin .controls-manager');
    if (manager && (!panel || !manager.contains(panel))) {
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
