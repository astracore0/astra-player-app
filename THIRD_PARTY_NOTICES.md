# Third-party notices

Astra Player itself is MIT licensed (see `LICENSE`). It uses the following parts, which keep their own licenses.
Please check each project for its exact current terms.

| Part | Used for | License |
|---|---|---|
| [AndroidX Media3 / ExoPlayer](https://github.com/androidx/media) | Video and audio playback in the Android app | Apache-2.0 |
| [NextLib (media3 FFmpeg extension)](https://github.com/anilbeesetti/nextlib) with [FFmpeg](https://ffmpeg.org) | Software decoders for formats the phone cannot play in hardware | Apache-2.0 (NextLib), LGPL-2.1-or-later (FFmpeg libraries) |
| [Vosk](https://alphacephei.com/vosk/) (`vosk-android`) and its small language models | Offline speech recognition for AI subtitles. Models are downloaded on demand from alphacephei.com | Apache-2.0 |
| [JNA](https://github.com/java-native-access/jna) | Native access used by Vosk | Apache-2.0 or LGPL-2.1-or-later |
| [whisper.cpp](https://github.com/ggerganov/whisper.cpp) and its ggml models | Optional offline model downloads; the Node server can use it for AI subtitles | MIT |
| AndroidX Core / WebKit | Android app support libraries | Apache-2.0 |

Online services reached only when you turn the matching feature on, each under its own terms:
AniList, TVmaze, iTunes Search, Wikipedia (covers), YouTube thumbnails, GitHub (update check), and the speech API you choose with your own key (for example Groq or OpenAI).
Cover images and thumbnails belong to their owners; they are only cached on your phone for display.
