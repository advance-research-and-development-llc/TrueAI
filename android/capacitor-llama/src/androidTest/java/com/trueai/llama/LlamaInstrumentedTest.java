package com.trueai.llama;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assume.assumeTrue;

import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;

/**
 * Instrumentation test for {@link LlamaBridge}.
 *
 * <p>This test only runs when the native library was actually compiled
 * into the APK (i.e. the build was invoked with
 * <code>-PenableLlamaNative=true</code>) AND a tiny GGUF model is
 * present at <code>/data/local/tmp/test-model.gguf</code>. Push one with:
 *
 * <pre>
 *   adb push tinyllama-1.1b-q2_k.gguf /data/local/tmp/test-model.gguf
 * </pre>
 *
 * <p>If either precondition is missing the test is <b>skipped</b> via
 * JUnit's {@link org.junit.Assume} so it never blocks the default
 * Android CI lane.
 */
@RunWith(AndroidJUnit4.class)
public class LlamaInstrumentedTest {

    private static final String TEST_MODEL_PATH = "/data/local/tmp/test-model.gguf";

    private LlamaBridge bridge;

    @After
    public void tearDown() {
        if (bridge != null && bridge.isLoaded()) {
            bridge.unloadModel();
        }
    }

    @Test
    public void loadAndCompleteWithTinyModel() {
        bridge = new LlamaBridge();
        assumeTrue(
            "native lib not built (pass -PenableLlamaNative=true to enable)",
            LlamaBridge.isNativeAvailable()
        );
        File model = new File(TEST_MODEL_PATH);
        assumeTrue(
            "test model not present at " + TEST_MODEL_PATH,
            model.exists() && model.canRead()
        );

        bridge.loadModel(TEST_MODEL_PATH, /*nCtx*/ 512, /*nThreads*/ 2, /*nGpuLayers*/ 0);
        assertTrue("model should report loaded", bridge.isLoaded());

        String out = bridge.complete(
            "Hello",
            /*nPredict*/ 8,
            /*temperature*/ 0.0f,  // deterministic so the test isn't flaky
            /*topP*/ 1.0f,
            /*topK*/ 1,
            /*minP*/ 0.0f,
            /*repeatPenalty*/ 1.0f
        );
        assertNotNull(out);

        bridge.unloadModel();
        assertEquals(false, bridge.isLoaded());
    }
}
