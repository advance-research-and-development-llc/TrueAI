package com.trueai.llama;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Java &lt;-&gt; JNI bridge for the vendored llama.cpp runtime.
 *
 * <p>This class is intentionally a thin pass-through. The Capacitor
 * plugin ({@link LlamaPlugin}) does the JS-facing argument validation,
 * threading, and result marshalling; this class just owns the native
 * handle and forwards to the C++ shim in
 * <code>src/main/cpp/llama_jni.cpp</code>.
 *
 * <p><b>Native lib lifecycle.</b> The shared library is loaded lazily on
 * first instantiation. If the lib was not compiled into the APK (for
 * example a debug build that did not pass <code>-PenableLlamaNative=true</code>
 * to Gradle, or a device whose ABI we don't ship), {@link #loadNativeLib}
 * captures the {@link UnsatisfiedLinkError} and the JNI methods later
 * surface the same error to {@link LlamaPlugin}, which translates it
 * into a Capacitor reject with code <code>ENGINE_UNAVAILABLE</code>.
 *
 * <p><b>Single-model invariant.</b> PR 2 supports exactly one loaded
 * model per process. Callers that need to swap models must
 * {@link #unloadModel()} first; {@link #loadModel} called while a model
 * is already loaded will throw. PR 4.b may relax this to a small LRU
 * cache, but only after the streaming surface in PR 4.a settles.
 *
 * <p><b>Streaming.</b> {@link #streamComplete} (PR 4) runs the decode
 * loop on the calling thread (a worker spawned by {@link LlamaPlugin}
 * — never the Capacitor main task queue) and delivers token pieces
 * synchronously through the supplied {@link TokenCallback}. The
 * {@link AtomicBoolean} cancel flag is polled by the C++ loop between
 * tokens; flipping it from another thread terminates the stream cleanly
 * with the most recently produced text.
 */
public class LlamaBridge {

    /**
     * Sink for streaming token pieces produced by {@link #streamComplete}.
     * Implementations are invoked from the C++ decode loop on the worker
     * thread and MUST NOT block — typical implementations forward to
     * Capacitor's {@code notifyListeners} which is itself non-blocking.
     */
    public interface TokenCallback {
        /**
         * Called once per generated token piece.
         *
         * @param piece       UTF-8 text for this token. May be empty for
         *                    control / non-printable tokens.
         * @param currentText Cumulative text generated so far. Equivalent
         *                    to concatenating every {@code piece}; mirrors
         *                    the {@code currentText} shape used by the
         *                    wllama adapter so the AI-SDK provider's
         *                    delta logic is identical on both runtimes.
         */
        void onToken(String piece, String currentText);
    }

    private static volatile boolean nativeLibLoaded = false;
    private static volatile Throwable nativeLibLoadError = null;

    /** Opaque pointer (a {@code llama_context*} cast to long) owned by C++. */
    private long contextHandle = 0L;

    public LlamaBridge() {
        loadNativeLib();
    }

    private static synchronized void loadNativeLib() {
        if (nativeLibLoaded || nativeLibLoadError != null) return;
        try {
            System.loadLibrary("trueai_llama_jni");
            nativeLibLoaded = true;
        } catch (UnsatisfiedLinkError | SecurityException e) {
            // Capture so callers can probe via isNativeAvailable() and so
            // every JNI call below can re-throw a consistent error.
            nativeLibLoadError = e;
        }
    }

    /** True only when the native shared library is usable in this process. */
    public static boolean isNativeAvailable() {
        return nativeLibLoaded;
    }

    public synchronized void loadModel(String modelPath, int nCtx, int nThreads, int nGpuLayers) {
        ensureNativeLib();
        if (contextHandle != 0L) {
            throw new IllegalStateException(
                "A model is already loaded; call unloadModel() before loading another."
            );
        }
        long handle = nativeLoadModel(modelPath, nCtx, nThreads, nGpuLayers);
        if (handle == 0L) {
            throw new IllegalStateException("nativeLoadModel returned a null handle");
        }
        contextHandle = handle;
    }

    public synchronized void unloadModel() {
        ensureNativeLib();
        if (contextHandle == 0L) return;
        try {
            nativeUnloadModel(contextHandle);
        } finally {
            contextHandle = 0L;
        }
    }

    public synchronized boolean isLoaded() {
        return nativeLibLoaded && contextHandle != 0L;
    }

    public synchronized String complete(
        String prompt,
        int nPredict,
        float temperature,
        float topP,
        int topK,
        float minP,
        float repeatPenalty
    ) {
        ensureNativeLib();
        if (contextHandle == 0L) {
            throw new IllegalStateException("No model loaded");
        }
        return nativeComplete(
            contextHandle, prompt, nPredict, temperature, topP, topK, minP, repeatPenalty
        );
    }

    /**
     * Stream a completion token-by-token. Blocks the calling thread for
     * the full duration of the decode loop; callers must invoke this
     * from a worker thread (see {@link LlamaPlugin#streamComplete}).
     * The {@code cancelled} flag is polled by the C++ loop between
     * tokens — flip it from any thread to request termination.
     *
     * <p>{@code synchronized} on the bridge instance guarantees that
     * {@link #loadModel} / {@link #unloadModel} called from another
     * thread cannot tear down the {@code contextHandle} mid-stream. As
     * a consequence, {@link #isLoaded} probes will block for the
     * stream's lifetime — that's the deliberate trade-off for the
     * single-model invariant; PR 4.b LRU work will revisit it.
     */
    public synchronized void streamComplete(
        String prompt,
        int nPredict,
        float temperature,
        float topP,
        int topK,
        float minP,
        float repeatPenalty,
        AtomicBoolean cancelled,
        TokenCallback callback
    ) {
        ensureNativeLib();
        if (contextHandle == 0L) {
            throw new IllegalStateException("No model loaded");
        }
        if (callback == null) {
            throw new IllegalArgumentException("callback is required");
        }
        if (cancelled == null) {
            // Defensive: provide a never-set flag so the C++ side can
            // unconditionally call get() without a null check.
            cancelled = new AtomicBoolean(false);
        }
        nativeStreamComplete(
            contextHandle,
            prompt,
            nPredict,
            temperature,
            topP,
            topK,
            minP,
            repeatPenalty,
            cancelled,
            callback
        );
    }

    private static void ensureNativeLib() {
        if (!nativeLibLoaded) {
            UnsatisfiedLinkError ule = new UnsatisfiedLinkError(
                "trueai_llama_jni native library is not available in this build"
            );
            if (nativeLibLoadError != null) {
                ule.initCause(nativeLibLoadError);
            }
            throw ule;
        }
    }

    // --- JNI surface (implemented in src/main/cpp/llama_jni.cpp) ---

    private static native long nativeLoadModel(
        String modelPath, int nCtx, int nThreads, int nGpuLayers
    );

    private static native void nativeUnloadModel(long handle);

    private static native String nativeComplete(
        long handle,
        String prompt,
        int nPredict,
        float temperature,
        float topP,
        int topK,
        float minP,
        float repeatPenalty
    );

    private static native void nativeStreamComplete(
        long handle,
        String prompt,
        int nPredict,
        float temperature,
        float topP,
        int topK,
        float minP,
        float repeatPenalty,
        AtomicBoolean cancelled,
        TokenCallback callback
    );
}
