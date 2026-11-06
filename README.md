# UFC on Paramount+ Without Spoilers

A userscript for [Paramount+](https://www.paramountplus.com) that never shows how long a video is or how much is left,
so you can watch UFC fight replays and event replays without knowing whether they ended in a finish or went to the
judges.

It only acts on **UFC, Dana White's Contender Series and LFA replays** (any series whose name or page contains UFC, LFA,
Legacy Fighting or Contender Series). Other shows, movies and **live events** are left exactly as Paramount+ shows
them. On mixed pages (home, My List, search) it hides durations and progress bars only on the cards of those series.

## What it does

- **Hides the duration everywhere**: the player's total time, its seek bar and ad-break markers, durations in episode
  lists and video pages ("21M", "3H 23M", "21M Jun 7, 2003", "4H 2M 24 oct 2026"), "39m left" / "Quedan 39 min" and the
  progress bars in Continue Watching.
- **Jump buttons**: −5 min, −1 min, −30 s, −10 s, +10 s, +30 s, +1 min, +5 min.
- **Fixed-scale seek bar** (90 min by default; click the scale label to pick 15/30/60/90/120 min). Its length doesn't
  depend on the video, so it reveals nothing. Past the end of a window it moves to the next one on its own; ‹ › look at
  the previous or next window.
- **Thumbnails on hover**, read from the tile sprites listed in the video's DASH manifest (each ad-break segment has its
  own tile set), or from the HLS image playlist that Safari gets, if the video has one. Short clips have no thumbnails,
  so they show "no preview" everywhere.
  Note: hovering past the end shows "no preview", which tells you the video is over by then.
- **iPhone and iPad**: its own touch controls (tap, double tap to jump, hold for 2x, a full screen that never
  uses Apple's player). See below.
- **YouTube-style clicks**: a short click on the video (or Space / K) plays or pauses with a brief icon in the middle,
  without bringing up the controls or the bar (moving the mouse does). Holding the click (or Space / K) plays at 2x
  until you let go.
- **Keyboard**: ←/→ 10 s · Shift 30 s · Ctrl 1 min · Ctrl+Shift 5 min · `T` shows/hides the elapsed time.
- Doesn't pass the duration to the OS / browser media controls (Media Session).

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in a Chromium browser (Brave, Chrome, Edge).
   In Brave/Chrome, open the extension's **Details** and turn on **Allow User Scripts**.
2. Open **[ufconparamount-withoutspoilers.user.js](https://raw.githubusercontent.com/JoelCohen7/ufconparamount-withoutspoilers/ios/ufconparamount-withoutspoilers.user.js)**
   and click **Install**. Tampermonkey checks that same link for updates.

Paramount+'s player doesn't start in LibreWolf with its default privacy settings, so use a Chromium browser.

`serve.py` serves this folder on `http://127.0.0.1:8765` with `charset=utf-8`, to install the script from a local copy.

## iPhone and iPad

Use **Safari** with the free **[Userscripts](https://apps.apple.com/app/userscripts/id1463298887)** app (open source,
by quoid). iOS 15.1 or later.

1. Install Userscripts from the App Store and open it once (it picks a folder for the scripts on its own).
2. Settings → Apps → Safari → Extensions → **Userscripts**: turn it on and set **All Websites → Allow**.
3. In Safari open **[ufconparamount-withoutspoilers.user.js](https://raw.githubusercontent.com/JoelCohen7/ufconparamount-withoutspoilers/ios/ufconparamount-withoutspoilers.user.js)**, tap the **puzzle piece / AA** button in the address bar → **Userscripts** →
   **Tap to install** → **Install**.
4. Open [paramountplus.com](https://www.paramountplus.com), sign in and play a video.

Userscripts checks the same link for updates (open its popup → **Check for updates**).

On a touch screen the player gets its own controls instead of the site's:

- **Tap** shows/hides them. While the video plays they hide by themselves after a few seconds.
- **Double tap** the left or right third: −10 s / +10 s. Keep tapping to add 10 s more each time (−20 s, −30 s…).
- **Hold** a finger on the video: 2x until you let go.
- **The bar**: drag your finger to see the thumbnail and the time; let go to jump there.
- **⛶** fills the screen. On iPhone, turning it sideways does that too (and upright again goes back). It is a full
  screen inside Safari, never Apple's own video player, which would show the duration. On iPhone Safari only hides its
  bars when the page scrolls, so **swipe up on the video** once to hide them (a hint says so while they show).
- **Two fingers** (full screen): pinch to zoom, drag to move the picture anywhere. Pinch below the original size to put
  it back as it was. The zoom and position are remembered.
- **⋯** brings back the site's own controls (settings, audio, etc.), still without any times. Tap it again to go back.
- **‹** goes back.
- On iPhone held upright only the bar and the time are shown; the jump buttons show up in full screen.

Safari's own full-screen player, Picture in Picture and AirPlay are blocked, because they show the duration. Safari's
"Open in the app" banner is not shown either. The lock
screen / Control Center "Now Playing" widget is told every video is 10 hours long, so its bar means nothing.

On an iPad with a keyboard the keyboard shortcuts work too; with a trackpad it behaves like a computer.

## Don't use

- The browser's Picture-in-Picture: that window has its own seek bar with the time.
- Chromecast/AirPlay: the TV's player shows the duration.

## Tested

Edge 156 and Brave on Windows 11, with fight replays and event replays from UFC 2000s (UFC 43, UFC 67), UFC 2010s
(UFC 110, UFC 195), numbered events (UFC 290, UFC 332), Fight Night and Dana White's Contender Series.

The iPhone/iPad controls were tested in WebKit (Safari's engine) emulating an iPhone 14 and an iPad Pro 11, on pages
that copy the player's structure, and the catalog hiding on the real site (signed out); not yet on a real device.
