package com.trueai.llama;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

/**
 * JVM unit tests for {@link LlamaBridge}. These run on the host JVM
 * (not on a device) and therefore cannot exercise the JNI library —
 * {@link System#loadLibrary(String)} fails on the host because
 * `libtrueai_llama_jni.so` is only built into the APK.
 *
 * <p>What we DO assert here is the graceful-degradation contract: when
 * the native lib is unavailable, every public method that needs it
 * throws {@link UnsatisfiedLinkError} (so {@link LlamaPlugin} can
 * translate it into the {@code ENGINE_UNAVAILABLE} reject), and the
 * probe methods ({@link LlamaBridge#isNativeAvailable()},
 * {@link LlamaBridge#isLoaded()}) return {@code false} instead of
 * throwing.
 */
public class LlamaBridgeTest {

    @Test
    public void isNativeAvailable_isFalseOnHostJvm() {
        // Construct to trigger the static loadLibrary attempt.
        new LlamaBridge();
        assertFalse(
            "native lib must not load on the host JVM (no .so present)",
            LlamaBridge.isNativeAvailable()
        );
    }

    @Test
    public void isLoaded_returnsFalseWithoutNativeLib() {
        LlamaBridge bridge = new LlamaBridge();
        // Probe must not throw — callers use this as a feature check.
        assertFalse(bridge.isLoaded());
    }

    @Test
    public void loadModel_throwsWhenNativeLibMissing() {
        LlamaBridge bridge = new LlamaBridge();
        try {
            bridge.loadModel("/dev/null", 2048, 4, 0);
            fail("expected UnsatisfiedLinkError when native lib is missing");
        } catch (UnsatisfiedLinkError expected) {
            assertTrue(expected.getMessage().contains("trueai_llama_jni"));
        }
    }

    @Test
    public void complete_throwsWhenNativeLibMissing() {
        LlamaBridge bridge = new LlamaBridge();
        try {
            bridge.complete("hello", 10, 0.8f, 0.95f, 40, 0.05f, 1.1f);
            fail("expected UnsatisfiedLinkError when native lib is missing");
        } catch (UnsatisfiedLinkError expected) {
            // Acceptable — the plugin re-maps to ENGINE_UNAVAILABLE.
        }
    }

    @Test
    public void unloadModel_isSafeWhenNativeLibMissing() {
        LlamaBridge bridge = new LlamaBridge();
        try {
            bridge.unloadModel();
            fail("expected UnsatisfiedLinkError when native lib is missing");
        } catch (UnsatisfiedLinkError expected) {
            // Acceptable.
        }
    }
}
