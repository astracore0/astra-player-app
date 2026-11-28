package com.astracore.astraplayer

import android.content.Context
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import io.github.anilbeesetti.nextlib.media3ext.ffdecoder.NextRenderersFactory
import java.nio.ByteBuffer
import kotlin.math.min

/**
 * Audio delay for the native player. Positive = sound later (silence is inserted),
 * negative = sound earlier (the first samples are skipped). Works on raw PCM, any channel layout.
 * Can be changed while playing.
 */
@UnstableApi
class AudioDelayProcessor : BaseAudioProcessor() {
    @Volatile var targetMs = 0
    private var applied = 0L       // frames already applied
    private var pendingSilence = 0L
    private var pendingDrop = 0L
    private var frameSize = 0
    private var rate = 0

    private fun targetFrames(): Long = targetMs.toLong() * rate / 1000L

    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        if (inputAudioFormat.encoding == androidx.media3.common.C.ENCODING_INVALID || inputAudioFormat.channelCount <= 0) return AudioProcessor.AudioFormat.NOT_SET
        rate = inputAudioFormat.sampleRate
        frameSize = inputAudioFormat.bytesPerFrame
        return inputAudioFormat
    }

    private fun restart() {
        val t = targetFrames()
        applied = t
        pendingSilence = if (t > 0) t else 0
        pendingDrop = if (t < 0) -t else 0
    }

    override fun onFlush(streamMetadata: AudioProcessor.StreamMetadata) { restart() }
    override fun onReset() { applied = 0; pendingSilence = 0; pendingDrop = 0 }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val size = inputBuffer.remaining()
        if (size == 0 || frameSize <= 0) return
        // delay changed while playing: apply only the difference
        val t = targetFrames()
        if (t != applied) {
            val d = t - applied
            if (d > 0) { val cancel = min(pendingDrop, d); pendingDrop -= cancel; pendingSilence += d - cancel }
            else { val cancel = min(pendingSilence, -d); pendingSilence -= cancel; pendingDrop += -d - cancel }
            applied = t
        }
        var frames = size / frameSize
        if (pendingDrop > 0) {
            val d = min(pendingDrop, frames.toLong()).toInt()
            inputBuffer.position(inputBuffer.position() + d * frameSize)
            pendingDrop -= d; frames -= d
        }
        val sil = pendingSilence.coerceAtMost(Int.MAX_VALUE.toLong() / frameSize / 2).toInt()
        val outSize = (sil + frames) * frameSize
        if (outSize == 0) { inputBuffer.position(inputBuffer.limit()); return }
        val out = replaceOutputBuffer(outSize)
        if (sil > 0) { out.put(ByteArray(sil * frameSize)); pendingSilence -= sil }
        if (frames > 0) { val lim = inputBuffer.limit(); inputBuffer.limit(inputBuffer.position() + frames * frameSize); out.put(inputBuffer); inputBuffer.limit(lim) }
        out.flip()
    }
}

/** NextRenderersFactory whose audio goes through [AudioDelayProcessor]. */
@UnstableApi
class AstraRenderersFactory(ctx: Context, val delay: AudioDelayProcessor) : NextRenderersFactory(ctx) {
    override fun buildAudioSink(context: Context, enableFloatOutput: Boolean, enableAudioOutputPlaybackParams: Boolean): AudioSink? =
        DefaultAudioSink.Builder(context).setAudioProcessors(arrayOf<AudioProcessor>(delay)).build()
}
