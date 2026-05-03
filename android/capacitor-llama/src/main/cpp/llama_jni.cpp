// JNI shim for `com.trueai.llama.LlamaBridge`.
//
// PR 2 scope: load + one-shot completion.
// PR 4 scope: streaming completion with cooperative cancellation.
//
// The C++ side owns a single `llama_model*` + `llama_context*` pair per
// Java handle. Streaming reuses the same context but delivers tokens
// incrementally to a Java `TokenCallback` and polls a Java
// `AtomicBoolean` between tokens for cooperative cancellation.
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

// Build the OfflineLLM-aligned sampler chain shared by nativeComplete
// and nativeStreamComplete. Caller takes ownership and must
// llama_sampler_free() the returned chain.
llama_sampler* build_sampler_chain(
    int topK, float topP, float minP, float temperature, float repeatPenalty
) {
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
    return sampler;
}

// Tokenize `prompt` against `vocab`. On success returns a non-empty
// vector and leaves no pending JNI exception. On failure returns an
// empty vector AND throws a RuntimeException via throw_runtime — the
// caller MUST check the JNI exception state (or just check that the
// vector is empty for a non-empty prompt) before continuing.
std::vector<llama_token> tokenize_prompt(
    JNIEnv* env, const llama_vocab* vocab, const std::string& prompt
) {
    int probe = llama_tokenize(
        vocab, prompt.c_str(), static_cast<int32_t>(prompt.size()),
        nullptr, 0, true, true
    );
    if (probe >= 0) {
        throw_runtime(env, "Tokenization probe returned an unexpected value");
        return {};
    }
    int n_prompt_tokens = -probe;
    std::vector<llama_token> tokens(n_prompt_tokens);
    if (llama_tokenize(
            vocab, prompt.c_str(), static_cast<int32_t>(prompt.size()),
            tokens.data(), n_prompt_tokens, true, true
        ) < 0) {
        throw_runtime(env, "Tokenization failed");
        return {};
    }
    return tokens;
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

    std::vector<llama_token> tokens = tokenize_prompt(env, vocab, prompt);
    if (tokens.empty()) {
        // A pending JNI exception was already raised by tokenize_prompt.
        return env->NewStringUTF("");
    }

    llama_sampler* sampler = build_sampler_chain(
        topK, topP, minP, temperature, repeatPenalty
    );

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

// PR 4: streaming completion. Same sampler chain as nativeComplete but
// delivers each token piece to a Java TokenCallback and polls a Java
// AtomicBoolean between tokens for cooperative cancellation.
//
// Returns void; status (stop/length/aborted/error) is communicated to
// the Java caller through:
//   - normal return         → finishReason "stop" (or "length" if
//     n_predict was reached) or "aborted" if cancelled flag was set.
//     The Java side decides which by checking the cancelled flag and
//     comparing tokens decoded vs nPredict.
//   - thrown exception      → finishReason "error" with message.
//
// The Java side wraps this in LlamaPlugin.streamComplete which emits
// the terminal {done: true, finishReason} listener frame.
JNIEXPORT void JNICALL
Java_com_trueai_llama_LlamaBridge_nativeStreamComplete(
    JNIEnv* env,
    jclass /*clazz*/,
    jlong   handle,
    jstring jPrompt,
    jint    nPredict,
    jfloat  temperature,
    jfloat  topP,
    jint    topK,
    jfloat  minP,
    jfloat  repeatPenalty,
    jobject jCancelled,
    jobject jCallback
) {
    if (handle == 0) {
        throw_runtime(env, "Invalid handle");
        return;
    }
    if (jCallback == nullptr) {
        throw_runtime(env, "callback is null");
        return;
    }
    auto* session = reinterpret_cast<LlamaSession*>(handle);
    if (!session->ctx || !session->model) {
        throw_runtime(env, "Session is not initialised");
        return;
    }

    std::string prompt = jstring_to_utf8(env, jPrompt);

    const llama_vocab* vocab = llama_model_get_vocab(session->model);
    if (!vocab) {
        throw_runtime(env, "Model has no vocab");
        return;
    }

    // Resolve Java method IDs once per call. Looking these up per-token
    // would still be fine (cheap relative to a forward pass) but doing
    // it once is tidier and matches the canonical JNI pattern.
    jclass cancelledCls = env->GetObjectClass(jCancelled);
    if (!cancelledCls) {
        throw_runtime(env, "AtomicBoolean class lookup failed");
        return;
    }
    jmethodID cancelledGet = env->GetMethodID(cancelledCls, "get", "()Z");
    if (!cancelledGet) {
        throw_runtime(env, "AtomicBoolean.get() lookup failed");
        return;
    }

    jclass callbackCls = env->GetObjectClass(jCallback);
    if (!callbackCls) {
        throw_runtime(env, "TokenCallback class lookup failed");
        return;
    }
    jmethodID onToken = env->GetMethodID(
        callbackCls, "onToken",
        "(Ljava/lang/String;Ljava/lang/String;)V"
    );
    if (!onToken) {
        throw_runtime(env, "TokenCallback.onToken() lookup failed");
        return;
    }

    std::vector<llama_token> tokens = tokenize_prompt(env, vocab, prompt);
    if (tokens.empty()) {
        // Tokenization failure already raised a pending JNI exception.
        return;
    }

    llama_sampler* sampler = build_sampler_chain(
        topK, topP, minP, temperature, repeatPenalty
    );

    std::string current;
    current.reserve(1024);

    llama_batch batch = llama_batch_get_one(tokens.data(), tokens.size());
    int n_decoded = 0;

    while (n_decoded < nPredict) {
        // Cancellation check between tokens. Do this BEFORE the next
        // decode so a flag flipped during the previous emit terminates
        // promptly without burning another forward pass.
        if (env->CallBooleanMethod(jCancelled, cancelledGet)) {
            break;
        }
        if (env->ExceptionCheck()) break;  // unexpected callback throw

        if (llama_decode(session->ctx, batch) != 0) {
            LOGE("llama_decode failed at stream step %d", n_decoded);
            break;
        }

        llama_token id = llama_sampler_sample(sampler, session->ctx, -1);
        if (llama_vocab_is_eog(vocab, id)) break;

        char piece[256];
        int piece_len = llama_token_to_piece(
            vocab, id, piece, sizeof(piece), 0, true
        );

        std::string pieceStr;
        if (piece_len > 0) {
            pieceStr.assign(piece, piece_len);
            current.append(pieceStr);
        }

        // Deliver to Java. Use NewStringUTF, which expects modified
        // UTF-8 — for the BMP and well-formed UTF-8 from llama_token_to_piece
        // this is safe; pathological tokens that produce malformed
        // sequences would surface as a ClassFormatError on the Java
        // side, which would propagate as a stream "error" frame via
        // the exception path below.
        jstring jPiece   = env->NewStringUTF(pieceStr.c_str());
        jstring jCurrent = env->NewStringUTF(current.c_str());
        env->CallVoidMethod(jCallback, onToken, jPiece, jCurrent);
        env->DeleteLocalRef(jPiece);
        env->DeleteLocalRef(jCurrent);

        if (env->ExceptionCheck()) {
            // The Java callback threw; abort the loop and let the
            // exception propagate to the Java caller, which will emit
            // a terminal {finishReason: "error"} frame.
            break;
        }

        batch = llama_batch_get_one(&id, 1);
        ++n_decoded;
    }

    llama_sampler_free(sampler);
}

}  // extern "C"
