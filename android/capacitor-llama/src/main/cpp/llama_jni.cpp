// JNI shim for `com.trueai.llama.LlamaBridge`.
//
// PR 2 scope: load + one-shot completion. The C++ side owns a single
// `llama_model*` + `llama_context*` pair per Java handle. PR 4 adds a
// streaming entry point that fires Capacitor events token-by-token.
//
// Threading: every JNI method assumes the Java caller already serialised
// access (LlamaBridge methods are `synchronized`). Do not call these
// directly without that guarantee — llama_context is not thread-safe.

#include <jni.h>
#include <android/log.h>

#include <atomic>
#include <memory>
#include <string>
#include <vector>

#include "llama.h"

#define LOG_TAG "trueai_llama_jni"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)

namespace {

struct LlamaSession {
    llama_model*   model = nullptr;
    llama_context* ctx   = nullptr;
};

// Convert a Java string to a UTF-8 std::string. Returns empty on null.
std::string jstring_to_utf8(JNIEnv* env, jstring s) {
    if (!s) return {};
    const char* chars = env->GetStringUTFChars(s, nullptr);
    if (!chars) return {};
    std::string out(chars);
    env->ReleaseStringUTFChars(s, chars);
    return out;
}

void throw_runtime(JNIEnv* env, const char* msg) {
    jclass cls = env->FindClass("java/lang/RuntimeException");
    if (cls) env->ThrowNew(cls, msg);
}

// llama_backend_init() is documented as a one-shot per-process
// initialiser. Guard with an atomic flag so concurrent loadModel calls
// (or successive load/unload cycles) never re-initialise the backend.
std::atomic<bool> g_backend_initialised{false};

void ensure_backend_initialised() {
    bool expected = false;
    if (g_backend_initialised.compare_exchange_strong(expected, true)) {
        llama_backend_init();
    }
}

}  // namespace

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_trueai_llama_LlamaBridge_nativeLoadModel(
    JNIEnv* env,
    jclass /*clazz*/,
    jstring jModelPath,
    jint    nCtx,
    jint    nThreads,
    jint    nGpuLayers
) {
    std::string path = jstring_to_utf8(env, jModelPath);
    if (path.empty()) {
        throw_runtime(env, "modelPath is empty");
        return 0;
    }

    ensure_backend_initialised();

    auto session = std::make_unique<LlamaSession>();

    llama_model_params mparams = llama_model_default_params();
    mparams.n_gpu_layers = nGpuLayers;

    session->model = llama_model_load_from_file(path.c_str(), mparams);
    if (!session->model) {
        LOGE("llama_model_load_from_file failed for %s", path.c_str());
        throw_runtime(env, "Failed to load model file");
        return 0;
    }

    llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx     = static_cast<uint32_t>(nCtx);
    cparams.n_threads = nThreads;
    cparams.n_threads_batch = nThreads;

    session->ctx = llama_init_from_model(session->model, cparams);
    if (!session->ctx) {
        llama_model_free(session->model);
        LOGE("llama_init_from_model failed");
        throw_runtime(env, "Failed to create llama context");
        return 0;
    }

    LOGI("Loaded model %s (n_ctx=%d, threads=%d, gpu_layers=%d)",
         path.c_str(), nCtx, nThreads, nGpuLayers);

    // Transfer ownership to Java as an opaque handle.
    return reinterpret_cast<jlong>(session.release());
}

JNIEXPORT void JNICALL
Java_com_trueai_llama_LlamaBridge_nativeUnloadModel(
    JNIEnv* /*env*/,
    jclass  /*clazz*/,
    jlong   handle
) {
    if (handle == 0) return;
    auto* session = reinterpret_cast<LlamaSession*>(handle);
    if (session->ctx)   llama_free(session->ctx);
    if (session->model) llama_model_free(session->model);
    delete session;
}

JNIEXPORT jstring JNICALL
Java_com_trueai_llama_LlamaBridge_nativeComplete(
    JNIEnv* env,
    jclass /*clazz*/,
    jlong   handle,
    jstring jPrompt,
    jint    nPredict,
    jfloat  temperature,
    jfloat  topP,
    jint    topK,
    jfloat  minP,
    jfloat  repeatPenalty
) {
    if (handle == 0) {
        throw_runtime(env, "Invalid handle");
        return env->NewStringUTF("");
    }
    auto* session = reinterpret_cast<LlamaSession*>(handle);
    if (!session->ctx || !session->model) {
        throw_runtime(env, "Session is not initialised");
        return env->NewStringUTF("");
    }

    std::string prompt = jstring_to_utf8(env, jPrompt);

    const llama_vocab* vocab = llama_model_get_vocab(session->model);
    if (!vocab) {
        throw_runtime(env, "Model has no vocab");
        return env->NewStringUTF("");
    }

    // Tokenize the prompt. llama_tokenize's "probe" call (null buffer,
    // size 0) returns a NEGATIVE value whose magnitude is the required
    // buffer size. Any non-negative value from the probe means the call
    // did not produce a usable size — treat as an error rather than
    // allocating an incorrectly-sized vector.
    int probe = llama_tokenize(
        vocab, prompt.c_str(), static_cast<int32_t>(prompt.size()),
        nullptr, 0, true, true
    );
    if (probe >= 0) {
        throw_runtime(env, "Tokenization probe returned an unexpected value");
        return env->NewStringUTF("");
    }
    int n_prompt_tokens = -probe;
    std::vector<llama_token> tokens(n_prompt_tokens);
    if (llama_tokenize(
            vocab, prompt.c_str(), static_cast<int32_t>(prompt.size()),
            tokens.data(), n_prompt_tokens, true, true
        ) < 0) {
        throw_runtime(env, "Tokenization failed");
        return env->NewStringUTF("");
    }

    // Build a sampler chain matching the OfflineLLM-aligned defaults.
    llama_sampler_chain_params sp = llama_sampler_chain_default_params();
    llama_sampler* sampler = llama_sampler_chain_init(sp);
    llama_sampler_chain_add(sampler, llama_sampler_init_top_k(topK));
    llama_sampler_chain_add(sampler, llama_sampler_init_top_p(topP, 1));
    llama_sampler_chain_add(sampler, llama_sampler_init_min_p(minP, 1));
    llama_sampler_chain_add(sampler, llama_sampler_init_temp(temperature));
    llama_sampler_chain_add(sampler, llama_sampler_init_penalties(
        /*penalty_last_n*/ 64,
        /*penalty_repeat*/ repeatPenalty,
        /*penalty_freq*/   0.0f,
        /*penalty_present*/ 0.0f
    ));
    llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    std::string output;
    output.reserve(512);

    llama_batch batch = llama_batch_get_one(tokens.data(), tokens.size());
    int n_decoded = 0;

    while (n_decoded < nPredict) {
        if (llama_decode(session->ctx, batch) != 0) {
            LOGE("llama_decode failed at step %d", n_decoded);
            break;
        }
        llama_token id = llama_sampler_sample(sampler, session->ctx, -1);
        if (llama_vocab_is_eog(vocab, id)) break;

        // Convert the sampled token to a string piece.
        char piece[256];
        int piece_len = llama_token_to_piece(
            vocab, id, piece, sizeof(piece), 0, true
        );
        if (piece_len > 0) output.append(piece, piece_len);

        // Prepare next batch with just the new token.
        batch = llama_batch_get_one(&id, 1);
        ++n_decoded;
    }

    llama_sampler_free(sampler);

    return env->NewStringUTF(output.c_str());
}

}  // extern "C"
