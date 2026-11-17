# Astra Player v1.21.8 — Web Player + Android APK wrapper

This repository contains the complete Astra Player Node.js/Express + FFmpeg web engine, the cinematic PWA update, and an Android APK host project.

## Build the Android APK (GitHub website only; no local terminal required)
1. Upload the contents of this repository ZIP to the root of your Astra Player GitHub repository. Preserve the `.github/workflows/build-apk.yml` path.
2. Open the repository's **Actions** tab and enable workflows if asked.
3. Run **Build Astra Player APK** (or push to `main`).
4. When the workflow completes, open the run and download the `Astra-Player-debug-APK` artifact.
5. Extract that artifact ZIP and install `app-debug.apk` on Android. Approve installation from that source if Android asks.

## Run the current Astra engine
The current server is Node.js + Express + FFmpeg and remains the source of truth for file indexing, video streaming/transcoding, subtitles, chapters, episode data, settings, history, tasks and diagnostics.

On the Android device:
1. Keep the existing Astra Termux setup and install requirements from `setup.sh` / the original setup guide.
2. Start Astra's server on port 3000 (`npm start` from the Astra project directory).
3. Open the Astra Android APK. It connects to `http://127.0.0.1:3000/`.
4. If the backend is not running, the APK shows a retry screen with an **Open Termux** shortcut.

## Important: what this APK is today
This APK is a native Android application shell hosting the existing Astra web player. It preserves the existing features because the original web player and server are retained. However, the Node.js + FFmpeg backend is **not yet bundled inside the APK**. Termux must run the server. So this is an APK app, but not yet a fully self-contained standalone APK.

A true standalone APK requires packaging Android-compatible Node.js and FFmpeg runtimes (or porting the server functionality to native Android APIs). This is a separate engineering step; this project does not pretend that it is already complete.

## Android wrapper capabilities
- Native launcher icon and application package `com.astra.player`.
- Fullscreen video handoff / immersive system bars.
- JavaScript, DOM storage, WebView media playback and download handoff.
- Android file picker callback for HTML file inputs.
- Retry/offline panel and Open Termux shortcut.
- GitHub Actions debug APK build.

## Web app
The original web UI and server are retained under `public/`, `server.js`, `package.json` and supporting files. The PWA manifest/service worker cache the static UI shell only; they do not cache media streams, subtitle endpoints, API responses or byte-range video requests.
