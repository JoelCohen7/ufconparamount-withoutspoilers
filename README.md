# UFC on Paramount+ Without Spoilers

A userscript for [Paramount+](https://www.paramountplus.com) that never shows how long a video is or how much is left,
so you can watch UFC fight replays and event replays without knowing whether they ended in a finish or went to the
judges. Made for the UFC libraries (UFC 2000s, UFC 2010s, numbered events, Fight Night, Dana White's Contender Series),
but it works on any Paramount+ video.

## What it does

- **Hides the duration everywhere**: the player's total time, its seek bar and ad-break markers, durations in episode
  lists and video pages ("21M", "3H 23M", "21M Jun 7, 2003"), "39m left" and the progress bars in Continue Watching.
- **Jump buttons**: −5 min, −1 min, −30 s, −10 s, +10 s, +30 s, +1 min, +5 min.
- **Fixed-scale seek bar** (90 min by default; click the scale label to pick 15/30/60/90/120 min). Its length doesn't
  depend on the video, so it reveals nothing. Past the end of a window it moves to the next one on its own; ‹ › look at
  the previous or next window.
- **Thumbnails on hover**, read from the tile sprites listed in the video's DASH manifest (each ad-break segment has its
  own tile set). Short clips have no thumbnails, so they show "no preview" everywhere.
  Note: hovering past the end shows "no preview", which tells you the video is over by then.
- **Touch-friendly bar**: on iPhone/iPad dragging previews the thumbnail and releasing jumps there.
- **Keyboard**: ←/→ 10 s · Shift 30 s · Ctrl 1 min · Ctrl+Shift 5 min · `T` shows/hides the elapsed time.
- Doesn't pass the duration to the OS / browser media controls (Media Session).

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in a Chromium browser (Brave, Chrome, Edge).
   In Brave/Chrome, open the extension's **Details** and turn on **Allow User Scripts**.
2. Open **[ufconparamount-withoutspoilers.user.js](https://raw.githubusercontent.com/JoelCohen7/ufconparamount-withoutspoilers/main/ufconparamount-withoutspoilers.user.js)**
   and click **Install**. Tampermonkey checks that same link for updates.

Paramount+'s player doesn't start in LibreWolf with its default privacy settings, so use a Chromium browser.

`serve.py` serves this folder on `http://127.0.0.1:8765` with `charset=utf-8`, to install the script from a local copy.

## Don't use

- The browser's Picture-in-Picture: that window has its own seek bar with the time.
- Chromecast/AirPlay: the TV's player shows the duration.

## Tested

Edge 156 and Brave on Windows 11, with fight replays and event replays from UFC 2000s (UFC 43, UFC 67), UFC 2010s
(UFC 110, UFC 195), numbered events (UFC 290, UFC 332), Fight Night and Dana White's Contender Series.
