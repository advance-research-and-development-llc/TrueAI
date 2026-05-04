package com.trueai.localai;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.trueai.filepicker.FilePickerPlugin;
import com.trueai.llama.LlamaPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register in-tree Capacitor plugins BEFORE super.onCreate() so the
        // bridge picks them up. Plugins shipped via npm packages are
        // auto-discovered by `cap sync`; ours live under `android/<name>/`
        // and so have to be registered explicitly.
        registerPlugin(LlamaPlugin.class);
        // PR 5: SAF-based file picker for the in-app GGUF importer.
        registerPlugin(FilePickerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
