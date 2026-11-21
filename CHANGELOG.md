# Changelog

## 2.9.1 (preview)
- App: the picture follows the page scroll frame by frame (stopgap until the native player screen).

## 2.9.0 (preview)
- App: view-size button (aA) in the header scales the whole app; edge-to-edge under the camera notch; fullscreen hides the page behind the player.
- App: Restore opens the file manager; Backup saves into the Download folder.
- App: telemetry (CPU, RAM) and AI settings show real values instead of "undefined".
- App: MKV chapters (named Opening / Ending / Preview like the server) and MP4 (mov_text) subtitles.

## 2.8.0 (preview)
- App: the native picture now sits exactly under the player box and is hidden on every other page; real fullscreen with native rotation; play/pause state updates instantly so the controls hide again.
- App: player errors show the real error code. Settings button next to the engine badge in the header.

## 2.7.0 (preview)
- App: embedded subtitle tracks (SRT/ASS, with styling and positions) and audio-track switching without any conversion.
- App: equalizer, bass boost, virtualizer and reverb use the phone's audio effects.
- App: brightness, contrast, saturation, hue and warmth filters on the picture. Sharpening and audio delay are not in the app yet.

## 2.6.0 (preview)
- **Standalone Android app** (`android/`): no Termux, no Node. Native ExoPlayer with hardware decoding first and bundled FFmpeg as the fallback (10-bit HEVC etc.), the same web UI inside a WebView, history and settings stored in the app. Built by the "Build Android app" GitHub Action.
- Not in the app yet: subtitles, audio-track switching, equalizer, video filters, AI subtitles.

## 2.5.0
- Settings: cache screen with sizes and clear buttons (covers & thumbnails, converted videos, everything).
- Library search ignores case, accents and punctuation, and matches words in any order.
- Backup & restore of watch history and settings (one JSON file).

## 2.4.0
- **Conversion cache for 10-bit / HEVC videos.** The converted video is written to disk; a finished conversion is replayed instantly from any position, with no re-encoding.
- Conversion keeps running while the video is paused, buffering, or the tab is closed (the old behaviour froze or stalled ffmpeg). Environment: `ASTRA_TC_CACHE_MB`, `ASTRA_NO_TC_CACHE`.
- New Quality tab in the player settings (Auto, 4K, 2K, 1080p, 720p, 480p, 360p) for converted videos; the choice is saved. Server gained a 2K (1440p) level.
- New Filters tab: preset dropdown with many extra presets, custom filters you can name and delete, sliders with +/- buttons.
- Equalizer: presets, 5 bands, reverb, bass boost and virtualizer.
- Themed controls: YouTube-style seek line, round +/- sliders, blue/white progress bars, one-line dropdowns.
- Toasts are coloured by message: green (done), yellow (warning), red (error), blue (info).
- Video output is sent in larger blocks, which is lighter on a phone's network stack over localhost.
- Fixes: episode list layout, watch history and library headers, offline text covers.

## 1.21.7
- Previous release.
