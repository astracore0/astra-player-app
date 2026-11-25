# Changelog

## 2.10.27 (app)
- **Enhanced backup:** the file now holds history, settings, watch stats and your subtitle files. A list of the last backups with a Restore button, Restore from any file, and optional **Auto backup** (every 7 days, keeps the last 5).
- **Import watch history** (Settings > Storage): reads a copy of an MX Player database, or a .json / .csv list, and fills in your watch positions. Best effort: columns are matched by name.
- **Home screen:** long-press the app icon for Resume, Files, Tasks; add icons for them from Settings > General; and a **Continue watching widget** (last video, progress, tap to resume).

## 2.10.26 (app)
- **Cinematic series page.** Tapping a series on Home opens a full page: big cover, title, rating, year, genres (online mode), synopsis, a Play / Resume button that picks the right episode, and the episode list with thumbnails and progress bars. Back button closes it.

## 2.10.25 (app)
- **Pause and real Resume for AI subtitle tasks.** A pause button on running tasks; Resume continues from the last finished piece (also after the app was closed), it no longer starts again from zero.
- **Subtitle sync:** tap the number to type an exact delay (1.35, -0.4, 0:2.5), `-` / `+` buttons (hold to repeat) around a slider, Reset button. Precision 0.01 s, range up to 10 minutes.
- **Sleep timer in the player settings** (Speed tab): Off, 15, 30, 45, 60 min or end of episode, with a live countdown.
- **Watch stats** (Settings > Watch stats): today, this week, all time, streak, last 7 days chart, episodes finished, most watched series.

## 2.10.24 (app)
- **Background keeps its original color.** The blurred cover backdrop is removed everywhere. This also fixes the player video looking faded in Online mode.
- **Task Manager shows real progress.** The percent now follows how much of the audio has been recognised, and moves smoothly while a piece is still being worked on (offline and online).
- **Fullscreen "Add subtitle file"** closes the settings panel first and no longer lets taps fall through to the player.
- Removed the "Fix video" buttons and the automatic fix prompt.
- README rewritten with screenshots. The Node.js web host files moved into the hidden `.web-host` folder.

## 2.10.23 (app)
- **Player opens with the last watched video** (paused at its saved position) and its series queue, instead of "Nothing playing".
- **Resume on Home now fills the Current Series Queue.**
- **Background no longer changes by itself:** the blurred backdrop used to switch to whichever cover loaded last; now it follows only the video that is open.

## 2.10.22 (app)
- **Whisper models can be downloaded** (Settings > Subtitles > Offline Subtitle Models: Whisper Tiny about 75 MB, Whisper Base about 142 MB, from the official whisper.cpp page). Download and delete only: the app cannot run them yet.
- **Licenses:** LICENSE updated, THIRD_PARTY_NOTICES.md added, and an "Open source licenses" list in App info.
- **README** rewritten around the two forms (Android app and Node server); package version brought up to date.
- Removed an unused file (`OnlineMeta.kt`, replaced by `Artwork.kt`).

## 2.10.21 (app)
- **Online mode covers now work in the app** (the app had no cover lookup at all before). It tries AniList (anime), TVmaze (series, web series), iTunes (movies) and Wikipedia (anything else with a poster), no keys needed. A cover is only used when the title really matches, so a movie does not get a random anime poster. Covers are saved on the phone, misses are remembered for a day. Files with a YouTube id in the name (`Title [id].mp4`) get YouTube's own thumbnail.
- **Home history:** only watched videos are listed now, the "NEXT / NEXT 2 / NEXT 3" cards are gone (the Next Ep button on the top card stays).
- **Online AI subtitles:** audio is now streamed to the service instead of being copied whole in memory, and low-RAM phones use 5-minute pieces. This avoids running out of memory on small phones. Real error reasons are shown in the task card ("Not enough memory...", "Connection problem: ...").

## 2.10.20 (app)
- **App info page:** app name and version at the top, last updated, developer, package, Android, device, CPU, memory, data folder, first installed. GitHub button and a "Buy me a coffee" button (switched off until it is set up).
- **Update check:** scans the GitHub releases of the project, ignores drafts, pre-releases and alpha / beta / rc tags, and only offers a version higher than the installed one, with its notes and a Download button. Checks when App info opens (at most every 6 hours) or with "Check for updates". Every build now publishes a release with the APK so there is something to find.
- **Subtitle picker in fullscreen:** the file list was hidden behind the fullscreen player. It now opens on top of it, and starts in the folder of the video you are watching.

## 2.10.19 (app)
- **Files menu rebuilt:** title FILES with a "Show Hidden Files" tick, a search box (filters the folder you are in), Back and Set Default Root, then plain rows: folder icon + original folder name, video / subtitle icon + the original file name (long names are cut in the middle so the type stays visible, e.g. `Astra-player showc...mp4`), and under it `Size: ... · date · TYPE`. Hidden files (starting with a dot) are hidden by default. The folder path shows in small text.
- **Settings:** the bottom tab bar (Home / Player / Files / Tasks) and the resume button are hidden while Settings is open.
- **Settings > App info:** version and build, package, Android version, device, CPU, memory, data folder, install and update time.

## 2.10.18 (app)
- **Files list** now shows size, date, NEW and "played" chips like the other lists (the folder reader did not send them before). Subtitle rows get a subtitle icon and the full file name (it showed "notes srt" before).
- **Subtitle picker** uses the same look: folder and subtitle icons, a Parent-folder row, size, an empty message.
- **Lighter on the GPU:** the live background blur on the top bar, tab bar and settings window is gone in the app (solid colors instead) and the glow filter on the active tab icon is removed. These were redrawn on every scrolled frame, which is heavy on a weak phone.

## 2.10.17 (app)
- **"Harmful app blocked" warning:** most likely caused by the battery-saving permission added in 2.10.16. It is removed. Settings > General now has a button that opens Android's own battery list (set Astra Player to Unrestricted there). If Play Protect still complains for a sideloaded app, tap More details > Install anyway once.
- **Tasks survive closing the app:** the task list is saved. Jobs that were running when the app closed come back as **Paused** and can be resumed (starts the subtitle job again) or cancelled.
- **Task Manager top bar:** a type dropdown (All / Active / Paused / Canceled / Failed / Completed) with a TASK count, then Clear and a clear Stop-all button (stop-sign icon).
- **Themes:** Settings > Customize: accent color (Blue, Red, Orange, Yellow, Green, White) and a pure black background switch.
- **New sliders** in the player filters and equalizer: filled from the neutral point (brightness, contrast, saturation, equalizer fill left or right of zero), a value bubble while dragging, 5% / 10% steps.

## 2.10.16 (app)
- **Empty gap above the top bar removed** (the page was adding a second top margin on top of the system bar).
- **Much harder for Android to kill the app:** a foreground service now runs while the app is open (notification "Running in the background"), the app asks once to be left out of battery saving, and it may use a bigger memory heap. No app can be completely immune: "Force stop" or a very low-memory phone can still end it.
## 2.10.15 (app)
- **System bars:** the status bar and the bottom (gesture / navigation) bar are now visible and the app sits clear of them in portrait, so the tab bar no longer hides under the gesture bar. They hide only while a video is in fullscreen (swipe from the edge to peek).
- **Back button of the phone** now works everywhere: closes a menu / dialog / panel first, leaves fullscreen, steps back through Settings pages and views, goes up a folder in Files. On the home page it sends the app to the background instead of closing it.
- **The 3-line menu is gone** (the tab bar at the bottom does the job). Tap the app name for Home.
- **Settings rebuilt:** a start page with General, Player, Storage, Customize and Subtitles; each opens its own page with a back button.
- **Subtitles page:** Offline Subtitle Models (a language list with a check mark on installed ones, Download / Delete / Cancel beside it) and Online AI Subtitles (optional): service, API key with show / hide eye, model list with "All models (best first)" as the default. Saving a key checks it with the service and tells you if it is valid. With "All", every model is tried best first and a model the service refuses is skipped.
- **Task Manager redesigned:** count tiles (Running / Waiting / Failed / Stopped / Done) that also filter, compact cards with a progress ring, small icon buttons (stop, try again, open video). The tab bar shows a badge with the number of running tasks.
- **Background work:** AI subtitle jobs now live in the app process, not the screen, and a small notification service keeps the app alive while jobs run, so they continue when you leave the app or close the screen. (Android may ask for notification permission once.)
- Menus and tooltips can no longer be wider than the screen.

## 2.10.14 (app)
- **Seek bar rebuilt.** One tall touch area (tap anywhere on the line or drag). The time bubble shows while you drag, the picture seeks when you let go, and the bar and time keep showing your target until the player arrives. The length now comes from the player itself, not from the file's metadata, so the time can no longer run past the end.
- **Controls:** no play button in the middle of the picture. Previous / Next episode now sit in the bottom row, in place of the -10 / +10 buttons (double-tap the left or right side of the picture still jumps 10 s).
- **UI size now also works in fullscreen.**
- **Buttons:** one quick press animation on every button, no sticky highlight after a tap, a cleaner play / pause icon change.
- **Names:** a series is named after the folder that holds its videos ("Darling in the Franxx"), not the folder the scan started from ("Anime"). Home cards, the hero line, the episode list title, links and cover search all use it. The hero title no longer shows a double bullet.
- **File lists (like a file manager):** a NEW tag, size, date and "Played 3 days ago" under every video. Settings > Customize: NEW period (off to 30 days) and a switch for the details.
- **Floating resume button** (bottom right) continues the last video from any page. Can be switched off in Customize.
- **Video decoder** (Settings > Player, app only): Auto, Hardware only, or Software (FFmpeg) first.
- **Files are now saved in the app's folder on the shared storage: `Android/data/com.astracore.astraplayer/files/` (`data/` history, profile and settings; `subtitles/` AI subtitles; `models/` speech models) and the thumbnail cache in `Android/data/com.astracore.astraplayer/cache/`. Old files are moved there on the first start. Settings > Storage shows the folders and their sizes. (Android deletes this folder if the app is uninstalled; use Backup for a safe copy.)
- **Saving:** the subtitle download button now saves a .srt into `Download/<AppName>-subtitles/` and backups into `Download/<AppName>-backup/` (the name follows Settings > App name). Settings > Storage lists these files with Delete / Delete all, and has Clear buttons for AI subtitles and the thumbnail cache.
- **Performance setting (app):** Fast (default) uses more of the phone: AI subtitles recognise several parts of the audio at the same time (as many as the CPU cores and RAM allow, up to 4) and the video buffer reads further ahead (up to 2 minutes, with a 30 s back buffer). Balanced uses half. Offline subtitles are also cut into 3-minute parts so they split across cores evenly. More worker threads for thumbnails.
- **Settings > AI subtitles > Offline speech models:** a Download / Cancel / Delete button for each language, with progress and size.
- **Big features are downloaded, not bundled:** the offline speech model (about 40-50 MB per language) is downloaded once, the first time you make offline subtitles, with progress in the Task Manager. The APK stays small.

## 2.10.12 (app)
- **Settings** is now split into sections: General, Player, Customize, Storage, AI subtitles, System. It is no longer in the 3-line menu; the gear in the header opens it and turns into a close button (X) while you are in it.
- **UI size** moved into Settings > General (the "aA" button in the header is gone).
- **Customize** (new): hide the Previous / Next buttons, the Next chapter / Next episode button, the TV button, the Lock button, or the quality chip.
- **Task Manager works in the app**: AI-subtitle jobs are listed with progress, Stop, Stop all, Clear finished and Retry.
- Tapping "ASTRA PLAYER" in the header opens the home page.
- Top-left title is now: big title with the blue " • S01E02", then length, size and file type. It is hidden while the video is paused.
- The top-right "NEXT" button now says NEXT CHAPTER (or NEXT EPISODE when the video has no more chapters).
- Removed the ping / speed badge, and the Auto-play, Auto-play-next and Pre-buffer settings (auto-play and auto-next stay on; the app has no server pre-buffer).
- App look: bottom tab bar (Home, Player, Files, Tasks), no text selection or grey tap flash, softer rounded cards.
- Bug audit fixes (each checked against the code first): the native player no longer runs the "no picture / frozen picture" transcoder fallback (#5); the web view can only open the app's own pages (#11); the activity now shuts down its worker threads on exit (#14); data files are written through unique temp files (#19); removed the unused duplicate root `script.js` (#8); README cache default corrected to 800 MB (#20).

## 2.10.11 (app)
- Player: only one play button (the big circle is gone); Previous / Play / Next stay visible while paused and sit further apart.
- Seek bar is a little higher and no longer gets thicker while touched.
- Controls and panels are more transparent / dimmer.
- Settings sheet has room to scroll to the last option.

## 2.10.10 (app)
- **UI size now works at every value (80%, 90%, 110% ...)**: the page is laid out wider/narrower and scaled by the WebView itself instead of shrinking the whole view. Before, everything except 100% had wrong touch areas, a black strip and a misplaced video.

## 2.10.9 (app)
- Fullscreen / landscape player always runs at 100% size. With "UI size" below 100% (for example 80%) the whole page was shrunk, which left a black strip at the bottom and moved the touch areas.

## 2.10.8 (app)
- **Offline subtitles by default** (Quick mode): speech-to-text with Vosk runs on the phone; a small language model is downloaded once. Online AI stays optional (Groq / OpenAI key).
- Subtitle lines are 8-12 words (about 24 characters for Japanese / Chinese), end at a sentence end or a pause, and use word timestamps so the timing matches the voice.
- Audio and subtitle tracks now show the real names from the file ("Hindi", "English [Full]") instead of "Audio 1 / Subtitle 1".
- Settings are kept even when the app is swiped away (mirrored into the app's own storage).
- Fullscreen / landscape: the page behind no longer scrolls, so the picture can't slide up and leave a black half.
- Settings > App name: new layout, and a button that adds a home-screen icon with your name.
- The folder picker opens at the main storage.

## 2.10.7 (app)
- App: settings tabs, episode list and chapters scroll with a finger (also in fullscreen).

## 2.10.6 (app)
- Player: **Previous / Play-Pause / Next** buttons in the centre of the picture (hide with the other controls).
- App: seeking jumps to the nearest keyframe (instant, even on slow phones) and can no longer get stuck in "seeking".
- App: embedded subtitles are drawn by the native player (SRT, ASS, WebVTT, image subtitles), so they work for every format the phone can read.

## 2.10.5 (app)
- App: **online AI subtitles** (Groq / OpenAI Whisper). The audio is decoded on the phone and sent in 10-minute pieces; the result is saved and reused. Add the key in Settings > Subtitles.
- App: **rename the app** in Settings (top bar, page title, welcome text).
- App: fixed the missing INTERNET permission (online covers and AI could never connect).
- App: logo, and a fixed signing key so updates install over the old app.

## 2.10.4
- Task Manager: the "converting video" card now shows what is really happening (resolution, speed, fps, running time) instead of a full bar, 0.0%, "0 Lines" and "Elapsed 0s".

## 2.10.3
- New "Fix video" button (Speed tab, and Quality tab for converted videos): deletes the saved conversion of the current video and converts it again. Asked automatically when a video has not started after 75 s.

## 2.10.2
- Converted-video cache: kept between ~200 MB and 800 MB. Above 800 MB the oldest converted videos are deleted down to ~200 MB (the newest is always kept). A single converted video may use the whole 800 MB (before, anything above 60% of the cap was not saved).

## 2.10.1
- Fixed: the quality choice (and hardware-encoder choice) reset to Auto on every page load.
- If a 10-bit video has not started after 40 s, Auto quality steps down and retries; the 75 s message now says what to do.

## 2.10.0
- Streaming: 4 MB read-ahead block cache in RAM (up to 200 MB) so 100 Mbps+ files stay smooth, even from slow storage.
- New quality: 1080p at 5 Mbps (capped bitrate, extra CPU for better picture).

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
