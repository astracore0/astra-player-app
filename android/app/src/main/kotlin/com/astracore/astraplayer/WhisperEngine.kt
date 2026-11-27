package com.astracore.astraplayer

/** whisper.cpp through JNI. The native library is only present in builds where it could be compiled; otherwise `available` is false. */
object WhisperEngine {
    val available: Boolean by lazy { try { System.loadLibrary("astra_whisper"); true } catch (t: Throwable) { false } }
    external fun nInit(path: String): Long
    external fun nFree(ctx: Long)
    external fun nRun(ctx: Long, pcm: FloatArray, lang: String, translate: Boolean, threads: Int): ByteArray
}
