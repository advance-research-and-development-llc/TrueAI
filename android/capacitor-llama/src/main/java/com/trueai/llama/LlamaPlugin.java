package com.trueai.llama;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Capacitor plugin exposing on-device llama.cpp inference to the JS
 * layer. Registered as <code>"Llama"</code> on the Capacitor bridge —
 * call sites should use the typed wrapper in
 * <code>src/lib/native/llama.ts</code> rather than addressing the
 * plugin directly.
 *
 * <p><b>Method surface.</b> {@code loadModel} / {@code unloadModel} /
 * {@code isLoaded} / {@code complete} (PR 2) plus {@code streamComplete}
 * / {@code abortStream} (PR 4). Streaming uses Capacitor
 * {@code notifyListeners} on the per-stream channel
 * {@code "llamaToken-&lt;streamId&gt;"} for tokens AND for the terminal
 * {@code {done: true, finishReason}} frame. The JS shim
 * (<code>src/lib/native/llama.ts</code>) generates the {@code streamId}
 * and registers the listener BEFORE invoking {@code streamComplete}, so
 * no token can be lost between subscribe and start.
 *
 * <p><b>Threading.</b> {@link #complete} runs on the Capacitor plugin
 * executor (a single dedicated background thread per plugin) and blocks
 * the executor for the duration of the decode. Streaming, however,
 * runs on a private {@link ExecutorService} so the plugin executor
 * stays free to handle {@link #abortStream} calls and concurrent
 * {@link #isLoaded} probes. PR 4.b's LRU work may grow this to a small
 * fixed-size pool.
 */
@CapacitorPlugin(name = "Llama")
public class LlamaPlugin extends Plugin {

    private final LlamaBridge bridge = new LlamaBridge();

    /**
     * Worker that runs streaming decodes off the Capacitor plugin
     * executor. Single-threaded for PR 4.a's single-model invariant —
     * concurrent stream submissions queue. PR 4.b's LRU may replace
     * this with a small fixed-size pool keyed by model id.
     */
    private final ExecutorService streamExecutor =
        Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "trueai-llama-stream");
            t.setDaemon(true);
            return t;
        });

    /**
     * In-flight stream cancel flags, keyed by the JS-supplied
     * {@code streamId}. Entry is added when the stream starts and
     * removed when the worker thread finishes (success, error, or
     * abort). {@link #abortStream} flips the flag if present; the C++
     * decode loop polls it between tokens.
     */
    private final ConcurrentHashMap<String, AtomicBoolean> cancelFlags =
        new ConcurrentHashMap<>();

    @PluginMethod
    public void loadModel(PluginCall call) {
        String modelPath = call.getString("modelPath");
        if (modelPath == null || modelPath.isEmpty()) {
            call.reject("modelPath is required");
            return;
        }
        File modelFile = new File(modelPath);
        if (!modelFile.exists() || !modelFile.canRead()) {
            call.reject("Model file does not exist or is not readable: " + modelPath);
            return;
        }

        Integer nCtx = call.getInt("nCtx", 2048);
        Integer nThreads = call.getInt("nThreads", 4);
        Integer nGpuLayers = call.getInt("nGpuLayers", 0);

        try {
            bridge.loadModel(modelPath, nCtx, nThreads, nGpuLayers);
            JSObject ret = new JSObject();
            ret.put("loaded", true);
            ret.put("modelPath", modelPath);
            call.resolve(ret);
        } catch (UnsatisfiedLinkError e) {
            // Native lib was not compiled into this APK (likely a
            // play/fdroid build that left -PenableLlamaNative off, or a
            // device whose ABI we don't ship). The JS shim translates
            // this into "engine unavailable" so the app falls back to
            // the existing local-wasm path.
            call.reject("Native llama runtime not available in this build", "ENGINE_UNAVAILABLE", e);
        } catch (Throwable t) {
            call.reject("Failed to load model: " + t.getMessage(), "LOAD_FAILED", t);
        }
    }

    @PluginMethod
    public void unloadModel(PluginCall call) {
        try {
            bridge.unloadModel();
            JSObject ret = new JSObject();
            ret.put("loaded", false);
            call.resolve(ret);
        } catch (UnsatisfiedLinkError e) {
            call.reject("Native llama runtime not available in this build", "ENGINE_UNAVAILABLE", e);
        } catch (Throwable t) {
            call.reject("Failed to unload model: " + t.getMessage(), "UNLOAD_FAILED", t);
        }
    }

    @PluginMethod
    public void isLoaded(PluginCall call) {
        JSObject ret = new JSObject();
        boolean loaded;
        try {
            loaded = bridge.isLoaded();
        } catch (UnsatisfiedLinkError e) {
            // No native lib → no model can be loaded. Don't reject —
            // callers use this as a probe.
            loaded = false;
        }
        ret.put("loaded", loaded);
        call.resolve(ret);
    }

    @PluginMethod
    public void complete(PluginCall call) {
        String prompt = call.getString("prompt");
        if (prompt == null) {
            call.reject("prompt is required");
            return;
        }

        Integer nPredict = call.getInt("nPredict", 256);
        Double temperature = call.getDouble("temperature", 0.8);
        Double topP = call.getDouble("topP", 0.95);
        Integer topK = call.getInt("topK", 40);
        Double minP = call.getDouble("minP", 0.05);
        Double repeatPenalty = call.getDouble("repeatPenalty", 1.1);

        try {
            String text = bridge.complete(
                prompt,
                nPredict,
                temperature.floatValue(),
                topP.floatValue(),
                topK,
                minP.floatValue(),
                repeatPenalty.floatValue()
            );
            JSObject ret = new JSObject();
            ret.put("text", text == null ? "" : text);
            ret.put("finishReason", "stop");
            call.resolve(ret);
        } catch (UnsatisfiedLinkError e) {
            call.reject("Native llama runtime not available in this build", "ENGINE_UNAVAILABLE", e);
        } catch (IllegalStateException e) {
            // Thrown by LlamaBridge.complete() when no model is loaded.
            call.reject(e.getMessage(), "NO_MODEL_LOADED", e);
        } catch (Throwable t) {
            call.reject("Completion failed: " + t.getMessage(), "COMPLETE_FAILED", t);
        }
    }

    /**
     * Start a streaming completion. Acknowledges synchronously by
     * resolving the call with {@code {streamId}}; token frames flow
     * over the {@code "llamaToken-<streamId>"} listener channel.
     */
    @PluginMethod
    public void streamComplete(PluginCall call) {
        final String streamId = call.getString("streamId");
        if (streamId == null || streamId.isEmpty()) {
            call.reject("streamId is required");
            return;
        }
        final String prompt = call.getString("prompt");
        if (prompt == null) {
            call.reject("prompt is required");
            return;
        }

        final int nPredict = call.getInt("nPredict", 256);
        final float temperature = call.getDouble("temperature", 0.8).floatValue();
        final float topP = call.getDouble("topP", 0.95).floatValue();
        final int topK = call.getInt("topK", 40);
        final float minP = call.getDouble("minP", 0.05).floatValue();
        final float repeatPenalty = call.getDouble("repeatPenalty", 1.1).floatValue();

        // Register the cancel flag BEFORE acknowledging start, so that
        // an abortStream call that races us cannot drop on the floor.
        final AtomicBoolean cancelled = new AtomicBoolean(false);
        cancelFlags.put(streamId, cancelled);

        // Acknowledge to JS so the streamComplete promise resolves and
        // the caller knows the listener channel is live.
        JSObject ack = new JSObject();
        ack.put("streamId", streamId);
        call.resolve(ack);

        streamExecutor.submit(() -> {
            String finishReason = "stop";
            String errorMessage = null;
            try {
                bridge.streamComplete(
                    prompt,
                    nPredict,
                    temperature,
                    topP,
                    topK,
                    minP,
                    repeatPenalty,
                    cancelled,
                    (piece, currentText) -> {
                        JSObject ev = new JSObject();
                        ev.put("piece", piece == null ? "" : piece);
                        ev.put("currentText", currentText == null ? "" : currentText);
                        notifyListeners("llamaToken-" + streamId, ev);
                    }
                );
                if (cancelled.get()) {
                    finishReason = "aborted";
                }
            } catch (UnsatisfiedLinkError e) {
                finishReason = "error";
                errorMessage = "Native llama runtime not available in this build";
            } catch (IllegalStateException e) {
                finishReason = "error";
                errorMessage = e.getMessage();
            } catch (Throwable t) {
                finishReason = "error";
                errorMessage = t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
            } finally {
                cancelFlags.remove(streamId);
                JSObject done = new JSObject();
                done.put("done", true);
                done.put("finishReason", finishReason);
                if (errorMessage != null) {
                    done.put("errorMessage", errorMessage);
                }
                notifyListeners("llamaToken-" + streamId, done);
            }
        });
    }

    /**
     * Signal cancellation for a previously-started stream. Resolves
     * immediately; the actual termination happens asynchronously when
     * the C++ decode loop next polls the cancel flag (typically within
     * one token). The listener channel still receives a terminal
     * {@code {done: true, finishReason: "aborted"}} frame.
     *
     * <p>Calling abort on an unknown {@code streamId} is a no-op (resolves
     * cleanly) — the stream may have already finished naturally between
     * the JS-side decision to abort and this call arriving.
     */
    @PluginMethod
    public void abortStream(PluginCall call) {
        String streamId = call.getString("streamId");
        if (streamId == null || streamId.isEmpty()) {
            call.reject("streamId is required");
            return;
        }
        AtomicBoolean flag = cancelFlags.get(streamId);
        if (flag != null) {
            flag.set(true);
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        // Mark every in-flight stream as cancelled so the workers exit
        // promptly, then shut the executor down. Critical for clean
        // process teardown — a dangling decode loop would keep the
        // JNI context alive past the activity's lifecycle.
        for (AtomicBoolean flag : cancelFlags.values()) {
            flag.set(true);
        }
        streamExecutor.shutdown();
        super.handleOnDestroy();
    }
}
