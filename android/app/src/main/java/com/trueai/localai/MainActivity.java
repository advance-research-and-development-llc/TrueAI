package com.trueai.localai;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.trueai.llama.LlamaPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register in-tree Capacitor plugins BEFORE super.onCreate() so the
        // bridge picks them up. Plugins shipped via npm packages are
        // auto-discovered by `cap sync`; ours lives in `android/capacitor-llama`
        // and so has to be registered explicitly. The plugin is dormant in
        // PR 2 (no JS callsite invokes it yet) — registering early just
        // means PR 4 can land the streaming surface without touching this
        // file again.
        registerPlugin(LlamaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
