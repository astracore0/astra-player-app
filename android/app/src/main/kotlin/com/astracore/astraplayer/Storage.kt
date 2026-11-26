package com.astracore.astraplayer

import android.content.Context
import java.io.File

/**
 * Where the app keeps its files. Everything lives in the app's own folder on the shared storage, so it can be seen,
 * tracked and copied for a backup:   Android/data/com.astracore.astraplayer/files/
 *   data/       history, profile, settings (json)
 *   subtitles/  AI subtitles that were made (.vtt) + index
 *   models/     offline speech models that were downloaded
 * and the thumbnail cache in   Android/data/com.astracore.astraplayer/cache/thumbs
 * (Android removes this folder when the app is uninstalled; the Backup button in Settings > Storage saves to Downloads.)
 */
object Storage {
    fun base(ctx: Context): File = (ctx.getExternalFilesDir(null) ?: ctx.filesDir).also { it.mkdirs() }
    fun data(ctx: Context): File = File(base(ctx), "data").also { it.mkdirs() }
    fun subs(ctx: Context): File = File(base(ctx), "subtitles").also { it.mkdirs() }
    fun models(ctx: Context): File = File(base(ctx), "models").also { it.mkdirs() }
    fun thumbs(ctx: Context): File = File(ctx.externalCacheDir ?: ctx.cacheDir, "thumbs").also { it.mkdirs() }

    fun size(f: File): Long = if (f.isFile) f.length() else (f.listFiles()?.sumOf { size(it) } ?: 0L)

    /** Older versions kept these files in the app's hidden internal folder; copy them over once, then remove the old ones. */
    @Synchronized fun migrate(ctx: Context) {
        val old = ctx.filesDir
        if (base(ctx).canonicalPath == old.canonicalPath) return
        val d = data(ctx)
        old.listFiles()?.forEach { f ->
            if (f.isFile && f.extension == "json") {
                val t = File(d, f.name)
                try { if (!t.exists()) f.copyTo(t); if (t.exists() && t.length() == f.length()) f.delete() } catch (e: Exception) { }
            }
        }
        moveDir(File(old, "ai"), subs(ctx)); moveDir(File(old, "vosk"), models(ctx))
    }

    private fun moveDir(src: File, dst: File) {
        if (!src.isDirectory) return
        try { if (src.copyRecursively(dst, overwrite = false)) src.deleteRecursively() } catch (e: Exception) { }
    }
}
