# Astra Player Android installable app (PWA)

This package adds an installable Android PWA shell and a cinematic fullscreen player presentation. It keeps the existing Node/Express + FFmpeg engine and all existing player JavaScript/control IDs.

## Install on Android
1. Start the existing Astra Player server in Termux (`npm start` or your existing start script).
2. Open `http://localhost:3000` in Chrome on the same Android device.
3. Open Chrome's menu and choose **Install app** (or **Add to Home screen**, depending on Chrome version).
4. Launch Astra from the home screen. It opens in standalone app mode without the normal browser tab/address bar.
5. Open an episode and use the fullscreen button. The player now uses a centred 16:9 cinematic stage on a black screen, with the controls arranged around the centre and seek bar at the bottom.

## What this changes
- Adds `manifest.webmanifest`, app icons, and a service worker for the static application shell.
- Adds a cinematic fullscreen layout using the existing controls and handlers.
- The service worker deliberately does **not** cache API responses, video streams, subtitle endpoints, or byte-range requests. This protects streaming, seeking, and local media behavior.
- Existing features remain in the app code: file scanning, playback, subtitles, chapter controls, episode drawer, settings, audio tools, transcoding, history, tasks and diagnostics.

## Important distinction
This is an installable PWA, not yet a self-contained APK. The Node.js + FFmpeg server must still be running in Termux. The PWA shell caches static UI assets only; it does not cache video files or replace the backend.

A truly standalone APK needs an Android host plus a bundled local Node runtime and FFmpeg binaries, or a carefully ported Kotlin/Media3 backend. Replacing the backend with a basic WebView would remove important capabilities, so this package intentionally does not do that.

## Notes
- PWA installation requires a secure context. `http://localhost` is treated as secure by Android browsers.
- Offline access to the full app requires the local Astra server to be running; only the static shell is cached by the service worker.
- The fullscreen player uses the existing fullscreen/orientation logic and does not force a new orientation preference.
