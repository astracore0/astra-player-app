#include <jni.h>
#include <string>
#include "whisper.h"

extern "C" {

JNIEXPORT jlong JNICALL Java_com_astracore_astraplayer_WhisperEngine_nInit(JNIEnv *env, jobject, jstring path) {
    const char *p = env->GetStringUTFChars(path, nullptr);
    struct whisper_context_params cp = whisper_context_default_params();
    cp.use_gpu = false;
    struct whisper_context *ctx = whisper_init_from_file_with_params(p, cp);
    env->ReleaseStringUTFChars(path, p);
    return (jlong) ctx;
}

JNIEXPORT void JNICALL Java_com_astracore_astraplayer_WhisperEngine_nFree(JNIEnv *, jobject, jlong c) {
    if (c != 0) whisper_free((struct whisper_context *) c);
}

// Returns "t0<TAB>t1<TAB>text" lines (times in 1/100 s) as UTF-8 bytes.
JNIEXPORT jbyteArray JNICALL Java_com_astracore_astraplayer_WhisperEngine_nRun(JNIEnv *env, jobject, jlong c, jfloatArray pcm, jstring lang, jboolean translate, jint threads) {
    struct whisper_context *ctx = (struct whisper_context *) c;
    jsize n = env->GetArrayLength(pcm);
    jfloat *data = env->GetFloatArrayElements(pcm, nullptr);
    const char *lg = env->GetStringUTFChars(lang, nullptr);
    struct whisper_full_params wp = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    wp.print_progress = false;
    wp.print_realtime = false;
    wp.print_timestamps = false;
    wp.print_special = false;
    wp.translate = translate == JNI_TRUE;
    wp.language = lg;
    wp.n_threads = threads;
    wp.no_context = true;
    wp.suppress_blank = true;
    std::string out;
    if (whisper_full(ctx, wp, data, (int) n) == 0) {
        int ns = whisper_full_n_segments(ctx);
        for (int i = 0; i < ns; i++) {
            out += std::to_string((long long) whisper_full_get_segment_t0(ctx, i)) + "\t" +
                   std::to_string((long long) whisper_full_get_segment_t1(ctx, i)) + "\t" +
                   whisper_full_get_segment_text(ctx, i) + "\n";
        }
    }
    env->ReleaseStringUTFChars(lang, lg);
    env->ReleaseFloatArrayElements(pcm, data, JNI_ABORT);
    jbyteArray res = env->NewByteArray((jsize) out.size());
    env->SetByteArrayRegion(res, 0, (jsize) out.size(), (const jbyte *) out.data());
    return res;
}

}
