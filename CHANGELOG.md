# Changelog

Every version and what is new in it. Newest first.

**Version names:** `2.10.38` is a stable release. `2.10.38-beta.1`, `2.10.38-alpha.1` and `2.10.38-experiment.1` are early builds. They are published on GitHub as pre-releases and the app only offers them if you pick that channel in Settings > App info > Updates.

## 2.12.4 (app)

- **Fits every phone size**, from small 320 px screens (older iPhone-size) up to the biggest modern ones. Tested on 320, 360, 375, 412 and 430 px wide screens.
- Player settings, episode list and chapter list now open as a big sheet over the whole screen on small phones instead of a tiny box inside the player.
- Toggles no longer stick out of the screen on very small phones, and the toggle knob is white on the violet track.

## 2.12.3 (app)

- **Audio delay now works in the app player**, and it goes both ways: from -5 s (sound earlier) to +5 s (sound later). Change it while the video plays.
- The **Pro Engine** info now opens over the whole app, not only inside the small player.
- A second theme colour: **violet** joins the blue on the seek bar, volume bar, logo, labels, badges, toggles and the skip button. It follows the accent you pick in Settings. No gradients.
- Small player is tidier: the title no longer breaks into letters, TV and Lock show as icons, and the volume bar only shows in fullscreen.

## 2.12.2 (app)

- The Skip / Next button is now the same size and shape as the other player buttons.

- **Volume slider** next to the speaker button, 0-100%. The lower half is extra fine, so it can go quieter than your phone's lowest volume step.
- **One Skip button.** "Next chapter" and "Skip opening/ending" are now a single button. It says Skip Opening / Skip Ending while those play (also with the controls hidden), otherwise Next chapter, or Next episode when there are no more chapters. It sits a little above the time and uses the app theme. Hold it to hide it for this video.
- **Video details and Recycle bin sheets** no longer sit under the bottom bar and the play button, and you can swipe them down to close.

## 2.12.1 (app)

- **Stable release** of everything since 2.11.1: Playback stats, Pro Engine info, the new video details sheet, the Recycle bin (30 days) and the quality readout fix.
- **Playback stats and Pro Engine info** now slide up from the bottom as a see-through sheet so you can still see the video. Swipe down to close it.
- **Clear cache, explained.** Each cache item now says what it removes and what it keeps. New "Online covers & info" item. Clear all only removes thumbnails and online covers. The screen also shows what is never cleared: history, settings, AI subtitles, speech models and the Recycle bin, each with its size.
- Fixed a long frame rate number (like 23.976024627685547fps) in the paused screen.

## 2.12.0-beta.1 (app)

- **Video details, redesigned.** Hold a video to open a new sheet with a big preview, quality chips (resolution, codec, 10-bit, fps), progress, and full info: size, container, duration, bitrate, video codec and frame rate, every audio track, subtitles and chapters inside the file, last played and the full path.
- **Delete with a safety net.** Delete moves the video (and its subtitle files) to the **Recycle bin**. It stays there for 30 days, then it is deleted for good. You can Undo right away.
- **Recycle bin.** Open it from the new Bin button in Files or from Settings > Storage. See how many days each video has left, restore it to where it was, delete it forever, or empty the bin.
- **Quality readout fixed.** Tapping "Quality 720p@24fps" in the player now opens the Playback stats window.

## 2.11.2-beta.1 (app)

- **Playback stats.** Tap "Quality" in the player to open a live window: resolution, frame rate, codec, bitrate, frames shown / dropped, how much is loaded ahead, playback speed and audio details.
- **Quality now shows the frame rate** like `720p@24fps`.
- **Pro Engine info.** Tap "Pro Engine" at the top to see which player and decoder are in use, the current video format and your phone's details.
- **Watch stats chart:** the time label now sits above each bar instead of on top of it, and is larger.

## 2.11.1 (app)

- **Hero banner widget** now loads (it showed "Can't load widget" on some phones).
- **Chapters in MP4:** the app now checks what is inside the file instead of trusting its name, and tries more MP4 chapter formats. Settings > App info > "Last chapter scan" shows what it found in the last video.
- **Skip Opening / Ending button** sits right above the Next chapter button (no overlap) and in the corner when the controls are hidden. Hold it to hide it for this video; it comes back when the controls show.

## 2.11.1-beta.1 (app)

- **Update prompt.** Every time you open the app and a newer version is out, an "Update the app" window shows what is new with an Update button. You also get a notification the first time a new version appears.
- **What's new window.** After you update, the app shows what is new and what was fixed in that version the first time you open it.

## 2.11.0 (app)

- **Home screen widgets, all new.** Long-press your home screen, pick Astra Player and choose:
  - **Hero banner** - big cover of your last video, title, progress and a Resume button.
  - **Continue watching** - redesigned small widget with the cover, time left and progress.
  - **Quick actions** - Resume, Files, Tasks and Home in one tap.
  - **Watch time** - today's watch time, your streak and a 7-day chart, like a screen-time card.
- Widgets update by themselves as you watch.
- **Chapters now load in MP4, M4V and MOV files** (before, only MKV and WebM files showed chapters).

## 2.10.50 (app)

- Build tools updated to current versions.

## 2.10.49 (app)

- NEW tag on playlists: "NEW" when the whole playlist is new, "NEW 3" when some videos were added recently (uses the NEW badge duration setting). Shown on series cards and on folders in Files.
- Play and pause now show a big icon in the middle, and the play button icon turns over.
- The 2x speed badge and the middle play/pause icon are now blurred glass in your theme colour.

## 2.10.47 (app)

- New series page: tall cover with the title, rating, chips, a big Resume button and the story on top; season tabs; episodes as a 2-column grid with episode numbers like S01E01.
- Each release now comes as separate files for each phone type: `-arm32.apk` (older 32-bit phones), `-arm64.apk` (newer phones) and `-universal.apk` (works on both, bigger). The in-app update picks the right one for your phone.

## 2.10.46 (app)

- Double-tap redesigned: skipping shows a half-circle glow with moving arrows and the total seconds. Keep tapping to keep adding (10s, 20s, 30s...). Double-tap in the middle shows a big play or pause icon.
- Animations now work on weak phones too: Low-memory mode only removes blur and shadow effects and list entrance animations; buttons, switches, toasts and the double-tap effect still animate.
- New animations: settings menu rows and sections, task list, button presses, option buttons, notes and messages.

## 2.10.45 (app)

- New Subtitles settings look: offline speech models and online AI in grouped boxes, model and language choices as scrolling buttons (installed ones have a green dot), and a download / delete row that shows the chosen model and its size.

## 2.10.44 (app)

- Presets now move the slider colour line and the value bubble right away.

## 2.10.43 (app)

- New slider look everywhere: slim line, round knob and a value bubble that stays above the knob.
- Subtitle sync and audio delay: value box with - and + buttons on top, one full-width slider line below.

## 2.10.42 (app)

- Audio delay redesigned: type an exact value, drag the slider, or tap a quick preset (0.1s, 0.25s, 0.5s, 1s). Reset button included.
- New "Screen fit" setting in Player: Fit, Fill or Auto. Auto fills the screen only when that crops about 15% or less of the picture.
- Fill screen now also works in the app player.
- All on/off switches have a new look (I = on, O = off).

## 2.10.41 (app)

- New settings look: General and Player as big tiles, other sections grouped in one box.
- Options with a few choices (seek step, low-memory mode, video decoder, performance, network mode, sleep timer, NEW tag) are now tap-to-pick buttons instead of dropdowns.
- Every setting description was re-checked against what the app really does and reworded to match.
- New notifications: title, line, message and a progress bar. They slide in from the right and out to the left.

## 2.10.40 (app)

- Subtitle background now sits only behind the words, line by line, instead of one dark block.
- Subtitle look menu: background colour and transparency, box corners, box padding, line spacing, letter spacing, text opacity, shadow blur and shadow colour.
- Colour picking: every colour (text, border, background, shadow) has a colour picker plus a hex box where you can type a value.
- Changed security functions.

## 2.10.39 (app)
- Player buttons (play, previous, next, episodes, settings, fullscreen) sit a little lower, closer to the bottom edge. The seek bar and everything above it stay where they were.
- Changelog rewritten to list only what is new in each version.

## 2.10.38 (app)
- **Update channels:** Settings > App info > Updates has a channel choice: Stable, Beta, Alpha or Experimental. Stable offers only stable releases; the others also offer early builds.
- Early builds (versions ending in `-beta.N`, `-alpha.N`, `-experiment.N`) are published as pre-releases, with the channel in the release title.

## 2.10.37 (app)
- README tidied.

## 2.10.36 (app)
- New icon that fills the whole square.
- A big play button appears in the middle of the picture when paused.
- Hold the picture to play at 2x speed; a ">> 2x Speed" badge shows at the top while you hold.
- New notification style: tinted card, coloured side stripe, icon, title with text and a close button.
- Task Manager timers stop for paused, stopped and failed tasks, and the running timer updates every second.
- The background notification is shown only while a subtitle task is running.

## 2.10.35 (app)
- New logo (app icon and header).
- **Files:** search covers the whole storage (folders, videos, subtitles) and shows where each result is. Folders show how many folders, videos and subtitles they hold. A "Grant permission" button appears when storage access is off. System folders are hidden.
- Hold menu on a video shows the picture of the video, size, date and format, with a Copy path button.
- "Add subtitle file" in fullscreen opens the phone's file chooser.
- Filter and equalizer sliders follow presets.
- **AI subtitles:** choose a backup model that is used if the first one does not finish (for example Online first, Whisper Base second).
- Thumbnails skip dark first frames. In Online mode, YouTube downloads named like `Title [Uploader] [720p].mp4` get their YouTube thumbnail when the title matches.

## 2.10.34 (app)
- Includes everything from 2.10.26 to 2.10.33.

## 2.10.33 (app)
- **Language** (Settings > General): English, Hindi, Spanish, French, Portuguese, German and Indonesian for menus, settings and main buttons.
- **Open with Astra Player:** the app appears when you open a video from a file manager or another app.
- The player picture has rounded corners that match the player border.
- Series page: full-height list without the bottom bar, episode numbers on thumbnails while frames load, and the frames you are looking at load first.

## 2.10.32 (app)
- All text in the TV connect dialog is in English.

## 2.10.31 (app)
- App messages and battery warnings appear as side notifications. One neutral card; only its side stripe changes colour (green done, yellow warning, gray neutral, blue info, red error).

## 2.10.30 (app)
- Task Manager shows app messages and battery warnings.

## 2.10.29 (app)
- **Whisper runs inside the app.** Download Whisper Tiny or Base (Settings > Subtitles), then pick it as the subtitle model. It works offline, can translate to English and shows real progress.

## 2.10.28 (app)
- **Choose the AI model for subtitles** (Offline Vosk, Offline Whisper or Online with your API key) in Settings > Subtitles and in the Make subtitles card. The choice is remembered.
- **Cast to TV (DLNA/UPnP):** player > TV > Cast to TV > Find TVs. The TV plays from your current position; pause, play and stop from the same dialog. Chromecast is not supported yet.

## 2.10.27 (app)
- **Enhanced backup:** history, settings, watch stats and your subtitle files in one file. Backup list with Restore, Restore from any file, and optional Auto backup (every 7 days, keeps the last 5).
- **Import watch history** (Settings > Storage) from an MX Player database copy, or a .json / .csv list.
- **Home screen:** long-press the app icon for Resume, Files and Tasks; add icons for them from Settings > General; a Continue watching widget.

## 2.10.26 (app)
- **Cinematic series page:** big cover, title, rating, year, genres (Online mode), synopsis, a Play / Resume button that picks the right episode, and the episode list with thumbnails and progress.

## 2.10.25 (app)
- **Pause and Resume for AI subtitle tasks**, also after the app was closed. Resume continues from the last finished part.
- **Subtitle sync:** type an exact delay, `-` / `+` buttons (hold to repeat) around a slider, Reset. Precision 0.01 s.
- **Sleep timer** in the player settings: Off, 15, 30, 45, 60 min or end of episode, with a live countdown.
- **Watch stats** (Settings > Watch stats): today, this week, all time, streak, last 7 days, episodes finished, most watched series.

## 2.10.24 (app)
- The app background keeps its original colour everywhere.
- Task Manager shows real progress while subtitles are made (offline and online).
- Cleaner subtitle picker in fullscreen.
- "Fix video" buttons removed.

## 2.10.23 (app)
- The player opens with the last watched video (paused at its saved position) and its series queue.
- Resume on Home fills the Current Series Queue.

## 2.10.22 (app)
- Whisper Tiny (about 75 MB) and Whisper Base (about 142 MB) can be downloaded in Settings > Subtitles.
- "Open source licenses" list in App info; LICENSE and THIRD_PARTY_NOTICES.md added.

## 2.10.21 (app)
- **Online mode covers:** AniList (anime), TVmaze (series), iTunes (movies) and Wikipedia, no keys needed. A cover is used only when the title really matches. Covers are saved on the phone. Files with a YouTube id in the name get YouTube's own thumbnail.
- Home history lists only watched videos.
- Online AI subtitles use less memory, with 5-minute parts on phones with little RAM, and show clear reasons in the task card when something goes wrong.

## 2.10.20 (app)
- **App info page:** name, version, last updated, developer, package, Android, device, CPU, memory, data folder, first installed, a GitHub button and a "Buy me a coffee" button (off until it is set up).
- **Update check:** looks at the GitHub releases and offers a newer version with its notes and a Download button.
- The subtitle file picker opens on top of the fullscreen player, starting in the folder of the video you are watching.

## 2.10.19 (app)
- **Files menu redesigned:** FILES title with a Show Hidden Files tick, search, Back and Set Default Root, then rows with the original folder and file names, size, date and type. Hidden files are off by default.
- The bottom tab bar and the resume button are hidden while Settings is open.
- App info page in Settings: version and build, package, Android version, device, CPU, memory, data folder, install and update time.

## 2.10.18 (app)
- File lists show size, date, NEW and "played" chips. The subtitle picker uses the same look.
- Lighter on the GPU: solid colours instead of live blur on the bars and Settings window.

## 2.10.17 (app)
- Settings > General has a button that opens Android's battery list, so you can set Astra Player to Unrestricted.
- **Tasks survive closing the app:** unfinished jobs come back as Paused and can be resumed or cancelled.
- **Task Manager top bar:** type dropdown (All / Active / Paused / Canceled / Failed / Completed), task count, Clear and Stop all.
- **Themes:** accent colour (Blue, Red, Orange, Yellow, Green, White) and a pure black background switch (Settings > Customize).
- New sliders in filters and equalizer: filled from the neutral point, value bubble while dragging, 5% / 10% steps.

## 2.10.16 (app)
- Top bar sits correctly under the system bar.
- Background work is more reliable: a service keeps the app running while the app is open and while subtitle tasks run, and the app can use a bigger memory heap.

## 2.10.15 (app)
- System status and navigation bars stay visible in portrait; the app sits clear of them. They hide only in fullscreen video.
- **Phone back button** works everywhere: closes menus and panels, leaves fullscreen, steps back through Settings and views, goes up a folder in Files. On the home page it sends the app to the background.
- The 3-line menu is replaced by the bottom tab bar. Tap the app name for Home.
- **Settings rebuilt:** a start page with General, Player, Storage, Customize and Subtitles, each with its own page.
- **Subtitles page:** Offline Subtitle Models (language list, Download / Delete / Cancel) and Online AI Subtitles (service, API key with show / hide, model list with "All models (best first)").
- **Task Manager redesigned:** count tiles that also filter, compact cards with a progress ring and small icon buttons. The tab bar shows a badge with the number of running tasks.
- AI subtitle jobs keep running when you leave the app or turn off the screen.

## 2.10.14 (app)
- **Seek bar rebuilt:** one tall touch area, time bubble while dragging, the picture seeks when you let go. The length comes from the player itself.
- Previous / Next episode sit in the bottom row. Double-tap the left or right side of the picture to jump 10 s.
- UI size also works in fullscreen.
- One quick press animation on every button.
- A series is named after the folder that holds its videos.
- **File lists like a file manager:** NEW tag, size, date and "Played 3 days ago". Settings > Customize: NEW period and a details switch.
- **Floating resume button** (bottom right) continues the last video from any page. Can be turned off in Customize.
- **Video decoder** (Settings > Player): Auto, Hardware only, or Software (FFmpeg) first.
- **Storage:** app data lives in `Android/data/com.astracore.astraplayer/files/` (`data/`, `subtitles/`, `models/`). Settings > Storage shows the folders and sizes. Use Backup for a safe copy.
- Subtitle downloads are saved as .srt into `Download/<AppName>-subtitles/` and backups into `Download/<AppName>-backup/`. Settings > Storage lists them with Delete / Delete all and has Clear buttons for AI subtitles and the thumbnail cache.
- **Performance setting:** Fast (default) uses more of the phone: parallel subtitle recognition, longer video read-ahead, more thumbnail workers. Balanced uses half.
- Offline speech models are downloaded on demand (about 40-50 MB per language) with progress in the Task Manager, so the APK stays small.

## 2.10.12 (app)
- **Settings** split into sections: General, Player, Customize, Storage, AI subtitles, System. The gear in the header opens it.
- UI size moved into Settings > General.
- **Customize:** hide Previous / Next, Next chapter / episode, TV, Lock or the quality chip.
- **Task Manager in the app:** AI-subtitle jobs with progress, Stop, Stop all, Clear finished and Retry.
- Top-left title: big title with the blue " • S01E02", then length, size and file type.
- The top-right button says NEXT CHAPTER (or NEXT EPISODE).
- New look: bottom tab bar (Home, Player, Files, Tasks), softer rounded cards.

## 2.10.11 (app)
- One play button; Previous / Play / Next stay visible while paused.
- Seek bar sits a little higher.
- More transparent controls and panels.
- Settings sheet scrolls to the last option.

## 2.10.10 (app)
- UI size works at every value (80%, 90%, 110% and so on).

## 2.10.9 (app)
- Fullscreen and landscape always use 100% size.

## 2.10.8 (app)
- **Offline subtitles by default:** Vosk speech-to-text runs on the phone; a small language model is downloaded once. Online AI (Groq / OpenAI key) stays optional.
- Subtitle lines are 8-12 words, break at sentence ends or pauses and use word timing.
- Audio and subtitle tracks show the names from the file ("Hindi", "English [Full]").
- Settings are kept even when the app is swiped away.
- Settings > App name has a new layout and a button that adds a home-screen icon with your name.
- The folder picker opens at the main storage.

## 2.10.7 (app)
- Settings tabs, episode list and chapters scroll with a finger, also in fullscreen.

## 2.10.6 (app)
- Previous / Play-Pause / Next buttons in the centre of the picture.
- Seeking jumps to the nearest keyframe, instant even on slow phones.
- Embedded subtitles (SRT, ASS, WebVTT, image subtitles) are drawn by the native player.

## 2.10.5 (app)
- **Online AI subtitles** (Groq / OpenAI Whisper): audio is decoded on the phone and sent in 10-minute parts; results are saved and reused. Add the key in Settings > Subtitles.
- **Rename the app** in Settings (top bar, page title, welcome text).
- New logo.

## 2.10.4
- Task Manager: the "converting video" card shows resolution, speed, fps and running time.

## 2.10.3
- "Fix video" button in the Speed and Quality tabs.

## 2.10.2
- Converted-video cache is kept between about 200 MB and 800 MB; the oldest converted videos are removed first.

## 2.10.1
- Quality and hardware-encoder choices are remembered.
- A 10-bit video that has not started after 40 s steps Auto quality down and retries.

## 2.10.0
- 4 MB read-ahead block cache in RAM (up to 200 MB) for smooth 100 Mbps+ files, even from slow storage.
- New quality: 1080p at 5 Mbps.

## 2.9.1 (preview)
- The picture follows the page scroll frame by frame.

## 2.9.0 (preview)
- View-size button (aA) in the header; edge-to-edge under the camera notch; fullscreen hides the page behind the player.
- Restore opens the file manager; Backup saves into the Download folder.
- MKV chapters (Opening / Ending / Preview) and MP4 (mov_text) subtitles.

## 2.8.0 (preview)
- The native picture sits exactly under the player box; real fullscreen with native rotation.
- Settings button next to the engine badge in the header.

## 2.7.0 (preview)
- Embedded subtitle tracks (SRT/ASS with styling and positions) and audio-track switching without conversion.
- Equalizer, bass boost, virtualizer and reverb using the phone's audio effects.
- Brightness, contrast, saturation, hue and warmth filters.

## 2.6.0 (preview)
- **Standalone Android app:** no Termux, no Node. Native ExoPlayer with hardware decoding first and FFmpeg as the fallback (10-bit HEVC and more), the same web UI, history and settings stored in the app.

## 2.5.0
- Settings: cache screen with sizes and clear buttons.
- Library search ignores case, accents and punctuation, and matches words in any order.
- Backup and restore of watch history and settings in one JSON file.

## 2.4.0
- **Conversion cache for 10-bit / HEVC videos:** a finished conversion replays instantly from any position.
- Conversion keeps running while the video is paused or buffering.
- Quality tab in the player settings (Auto, 4K, 2K, 1080p, 720p, 480p, 360p); the choice is saved.
- Filters tab: preset dropdown with many presets, custom filters you can name and delete, sliders with +/- buttons.
- Equalizer: presets, 5 bands, reverb, bass boost and virtualizer.
- Themed controls: YouTube-style seek line, round +/- sliders, blue/white progress bars, one-line dropdowns.
- Notifications coloured by message: green (done), yellow (warning), red (error), blue (info).

## 1.21.7
- Previous release.
