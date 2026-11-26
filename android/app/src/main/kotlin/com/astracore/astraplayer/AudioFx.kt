package com.astracore.astraplayer

import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.PresetReverb
import android.media.audiofx.Virtualizer
import org.json.JSONObject
import kotlin.math.abs

/** Equalizer, bass boost, virtualizer and reverb on the player's audio session (Android's built-in effects). */
class AudioFx {
    private var eq: Equalizer? = null
    private var bass: BassBoost? = null
    private var virt: Virtualizer? = null
    private var rev: PresetReverb? = null
    private var last: JSONObject? = null
    private val webBands = intArrayOf(60, 230, 910, 3600, 14000)

    fun attach(session: Int) {
        release()
        if (session == 0) return
        try { eq = Equalizer(0, session) } catch (e: Exception) { }
        try { bass = BassBoost(0, session) } catch (e: Exception) { }
        try { virt = Virtualizer(0, session) } catch (e: Exception) { }
        try { rev = PresetReverb(0, session) } catch (e: Exception) { }
        last?.let { applyFx(it) }
    }

    fun release() {
        try { eq?.release() } catch (e: Exception) { }
        try { bass?.release() } catch (e: Exception) { }
        try { virt?.release() } catch (e: Exception) { }
        try { rev?.release() } catch (e: Exception) { }
        eq = null; bass = null; virt = null; rev = null
    }

    fun applyFx(o: JSONObject) {
        last = o
        val on = o.optBoolean("on", true)
        val arr = o.optJSONArray("bands")
        try {
            val e = eq
            if (e != null) {
                val n = e.numberOfBands.toInt()
                val lo = e.bandLevelRange[0].toInt()
                val hi = e.bandLevelRange[1].toInt()
                val sum = IntArray(n)
                val cnt = IntArray(n)
                for (i in webBands.indices) {
                    val gain = if (on && arr != null) arr.optDouble(i, 0.0) else 0.0
                    var best = 0
                    var bd = Int.MAX_VALUE
                    for (b in 0 until n) {
                        val c = e.getCenterFreq(b.toShort()) / 1000
                        val d = abs(c - webBands[i])
                        if (d < bd) { bd = d; best = b }
                    }
                    sum[best] += (gain * 100).toInt(); cnt[best]++
                }
                for (b in 0 until n) {
                    val level = if (cnt[b] > 0) sum[b] / cnt[b] else 0
                    e.setBandLevel(b.toShort(), level.coerceIn(lo, hi).toShort())
                }
                e.enabled = on
            }
        } catch (ex: Exception) { }
        try {
            val b = bass
            if (b != null) {
                val v = o.optInt("boost", 0)
                if (b.strengthSupported) b.setStrength((v * 10).coerceIn(0, 1000).toShort())
                b.enabled = on && v > 0
            }
        } catch (ex: Exception) { }
        try {
            val vz = virt
            if (vz != null) {
                val v = o.optInt("virt", 0)
                if (vz.strengthSupported) vz.setStrength((v * 10).coerceIn(0, 1000).toShort())
                vz.enabled = on && v > 0
            }
        } catch (ex: Exception) { }
        try {
            val r = rev
            if (r != null) {
                val name = o.optString("reverb", "none")
                r.preset = when (name) {
                    "room" -> PresetReverb.PRESET_SMALLROOM
                    "hall" -> PresetReverb.PRESET_LARGEHALL
                    "plate" -> PresetReverb.PRESET_PLATE
                    else -> PresetReverb.PRESET_NONE
                }
                r.enabled = on && name != "none"
            }
        } catch (ex: Exception) { }
    }
}
