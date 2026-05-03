package com.trueai.llama;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Capacitor plugin exposing on-device llama.cpp inference to the JS
 * layer. Registered as <code>"Llama"</code> on the Capacitor bridge —
 * call sites should use the typed wrapper in
 * <code>src/lib/native/llama.ts</code> rather than addressing the
 * plugin directly.
 *
 * <p>PR 2 scope: load / unload / isLoaded / one-shot complete. Streaming
 * (<code>streamComplete</code>), token-level callbacks, and abort
 * propagation land in PR 4.
 *
 * <p>The plugin is dormant by default — no app code calls these methods
 * yet. The class is shipped now so PR 4 can land a small, focused
 * streaming + AI-SDK-provider diff on top of an already-reviewed
 * scaffold.
 *
 * <p><b>Threading.</b> All native calls run on the Capacitor plugin
 * executor (a dedicated background thread per plugin), not the main
 * thread, so {@code complete()} blocking on token generation will not
 * jank the UI. Once streaming lands the executor switches to a thread
 * pool so multiple cancellable streams can run.
 */
@CapacitorPlugin(name = "Llama")
public class LlamaPlugin extends Plugin {

    private final LlamaBridge bridge = new LlamaBridge();

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
}
