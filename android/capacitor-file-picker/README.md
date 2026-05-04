# TrueAI in-tree Capacitor `FilePicker` plugin

Local-first file picker for the GGUF importer (PR 5). Wraps the Android
Storage Access Framework (`Intent.ACTION_OPEN_DOCUMENT`) and exposes a
small surface that the JS shim in `src/lib/native/file-picker.ts`
consumes:

| JS method            | What it does                                                                                  |
|----------------------|-----------------------------------------------------------------------------------------------|
| `pickGgufFile()`     | Launches the system file picker filtered to `application/octet-stream` (with `.gguf` hint), copies the picked stream into `getFilesDir()/models/import-staging/<uuid>.gguf`, returns `{uri, displayName, size}`. |
| `getFreeSpaceBytes()`| Returns `StatFs(getFilesDir()).getAvailableBytes()`. Used by the registry to refuse imports that would fill the disk. |

## Why the staging copy

A `content://` URI returned by SAF is sandboxed: the app holds a
read grant only for the lifetime of the activity result (or until the
process restarts) unless we go through the `takePersistableUriPermission`
ceremony. Even then the URI is opaque — it does NOT round-trip to a
`file://` path, so llama.cpp's `mmap` cannot open it.

We side-step the entire problem by streaming the bytes through Java
into app-private storage on import. The resulting `file://` URI is
stable across process restarts and directly mappable. The trade-off
is a one-time copy; the registry then de-dupes via SHA-256 so importing
the same file twice doesn't cost a second copy.

## No permissions requested

`AndroidManifest.xml` is empty — SAF is the only access path and it
runs in the system picker process, not ours. This keeps the plugin
compatible with the future `offline` product flavor (PR 17) which
strips `INTERNET` from the merged manifest.

## Registered in `MainActivity`

`MainActivity.onCreate(...)` calls `registerPlugin(FilePickerPlugin.class)`
**before** `super.onCreate(...)` so the bridge picks the plugin up at
startup. (This mirrors the recipe used by `capacitor-llama`.)
