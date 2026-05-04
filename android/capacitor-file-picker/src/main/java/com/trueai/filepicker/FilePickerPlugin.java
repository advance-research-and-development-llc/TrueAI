// Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
// Advanced Technology Research. Licensed under MIT.

package com.trueai.filepicker;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.StatFs;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

/**
 * Local-first file picker for the in-app GGUF importer (PR 5).
 *
 * <p>Surface:
 * <ul>
 *   <li>{@code pickGgufFile()} — launches {@code ACTION_OPEN_DOCUMENT}
 *       filtered to {@code application/octet-stream} (with a {@code .gguf}
 *       extension hint). On selection the picked stream is copied into
 *       {@code getFilesDir()/models/import-staging/&lt;uuid&gt;.gguf}
 *       and the resulting {@code file://} URI is returned to JS.</li>
 *   <li>{@code getFreeSpaceBytes()} — returns
 *       {@code StatFs(getFilesDir()).getAvailableBytes()}.</li>
 * </ul>
 *
 * <p>The staging-copy step is essential: a SAF {@code content://} URI
 * is opaque (not a file path) and cannot be opened by llama.cpp's
 * mmap-based loader. Copying once at import time gives us a stable
 * file path that survives process restart, and the registry's
 * SHA-256 de-dupe means re-importing the same file is cheap.
 */
@CapacitorPlugin(name = "FilePicker")
public class FilePickerPlugin extends Plugin {

    /**
     * Buffer used by the staging-copy stream loop. 256 KiB is large
     * enough to amortise per-syscall overhead on multi-GB models and
     * small enough to keep peak memory bounded on low-end devices.
     */
    private static final int COPY_BUFFER_BYTES = 256 * 1024;

    /**
     * Subdirectory under {@code Context.getFilesDir()} where picked
     * files are staged before the JS-side registry promotes them to
     * their final SHA-named home. The JS-side code is allowed to
     * delete this entry once import succeeds.
     */
    private static final String STAGING_SUBDIR = "models/import-staging";

    @PluginMethod
    public void pickGgufFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // Some SAF backends key off MIME, others off extension; supply
        // both so the picker behaves identically across vendors.
        intent.setType("*/*");
        intent.putExtra(
            Intent.EXTRA_MIME_TYPES,
            new String[] { "application/octet-stream", "application/gguf", "*/*" }
        );
        // Persisted URI permission is irrelevant — we copy the bytes
        // out immediately and never re-open the original URI.
        startActivityForResult(call, intent, "onPickerResult");
    }

    @ActivityCallback
    private void onPickerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            // User cancelled — resolve with `cancelled: true` so JS can
            // distinguish "no pick" from a hard error and stay quiet.
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }
        Intent data = result.getData();
        Uri picked = data == null ? null : data.getData();
        if (picked == null) {
            call.reject("Picker returned no URI", "PICK_NO_URI");
            return;
        }
        try {
            JSObject staged = stageToFiles(picked);
            call.resolve(staged);
        } catch (Throwable t) {
            call.reject("Failed to stage picked file: " + t.getMessage(), "STAGE_FAILED", t);
        }
    }

    /**
     * Copy the picked stream into app-private storage and gather the
     * filename + size metadata via the SAF cursor. Returns a JS object
     * with {@code uri}, {@code displayName}, {@code size}.
     */
    private JSObject stageToFiles(Uri picked) throws Exception {
        String displayName = queryDisplayName(picked);
        long declaredSize = queryDeclaredSize(picked);
        File parent = new File(getContext().getFilesDir(), STAGING_SUBDIR);
        if (!parent.exists() && !parent.mkdirs()) {
            throw new IllegalStateException(
                "Could not create staging directory: " + parent.getAbsolutePath()
            );
        }
        String safeName = sanitiseFilename(displayName);
        File staged = new File(parent, UUID.randomUUID().toString() + "-" + safeName);
        long copied = 0L;
        try (InputStream in = getContext().getContentResolver().openInputStream(picked);
             OutputStream out = new FileOutputStream(staged)) {
            if (in == null) {
                throw new IllegalStateException("ContentResolver returned null InputStream");
            }
            byte[] buf = new byte[COPY_BUFFER_BYTES];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                copied += n;
            }
        }
        JSObject ret = new JSObject();
        ret.put("uri", "file://" + staged.getAbsolutePath());
        ret.put("displayName", safeName);
        // Prefer the actual copied byte count over the declared size:
        // some content providers (e.g. Drive) report -1 for `_size`.
        ret.put("size", copied);
        ret.put("declaredSize", declaredSize);
        ret.put("cancelled", false);
        return ret;
    }

    private String queryDisplayName(Uri picked) {
        try (Cursor c = getContext().getContentResolver().query(
            picked,
            new String[] { OpenableColumns.DISPLAY_NAME },
            null, null, null
        )) {
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) {
                    String name = c.getString(idx);
                    if (name != null && !name.isEmpty()) return name;
                }
            }
        } catch (Throwable ignored) {
            // Fall through to the synthetic name below.
        }
        return "imported.gguf";
    }

    private long queryDeclaredSize(Uri picked) {
        try (Cursor c = getContext().getContentResolver().query(
            picked,
            new String[] { OpenableColumns.SIZE },
            null, null, null
        )) {
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.SIZE);
                if (idx >= 0 && !c.isNull(idx)) {
                    return c.getLong(idx);
                }
            }
        } catch (Throwable ignored) {
            // Some providers refuse to answer — fall through.
        }
        return -1L;
    }

    /**
     * Reduce the SAF-supplied display name to a filesystem-safe form.
     * Mirrors the JS-side {@code sanitiseFilename} in
     * {@code src/lib/native/filesystem.ts} so on-disk names stay
     * predictable across the bridge.
     */
    private String sanitiseFilename(String name) {
        if (name == null || name.isEmpty()) return "imported.gguf";
        String cleaned = name
            .replaceAll("[^A-Za-z0-9._-]+", "_")
            .replaceAll("\\.{2,}", "_")
            .replaceAll("^[._]+", "")
            .replaceAll("_+", "_");
        if (cleaned.length() > 120) cleaned = cleaned.substring(0, 120);
        if (cleaned.isEmpty()) return "imported.gguf";
        return cleaned;
    }

    @PluginMethod
    public void getFreeSpaceBytes(PluginCall call) {
        try {
            File dir = getContext().getFilesDir();
            StatFs stats = new StatFs(dir.getAbsolutePath());
            long bytes;
            // StatFs.getAvailableBytes() is API 18+. minSdk in this
            // project is well above that, but the explicit check is
            // cheap and silences a lint warning when the project bumps
            // minSdk in the other direction.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
                bytes = stats.getAvailableBytes();
            } else {
                bytes = (long) stats.getAvailableBlocks() * (long) stats.getBlockSize();
            }
            JSObject ret = new JSObject();
            ret.put("bytes", bytes);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("Failed to query free space: " + t.getMessage(), "STATFS_FAILED", t);
        }
    }

    /**
     * Best-effort delete of a staged file produced by
     * {@link #stageToFiles(Uri)}. The JS-side registry calls this
     * after it has copied the staged file into its final SHA-named
     * location, or after a failed import. Idempotent.
     */
    @PluginMethod
    public void deleteStaged(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null || uri.isEmpty()) {
            call.reject("uri is required");
            return;
        }
        try {
            String path = uri.startsWith("file://") ? uri.substring("file://".length()) : uri;
            File f = new File(path);
            // Defence in depth: only allow deletes that resolve under
            // our staging directory. A misbehaving caller cannot use
            // this to wipe arbitrary files.
            File stagingRoot = new File(getContext().getFilesDir(), STAGING_SUBDIR).getCanonicalFile();
            File target = f.getCanonicalFile();
            if (!target.getAbsolutePath().startsWith(stagingRoot.getAbsolutePath() + File.separator)) {
                call.reject("Refusing to delete file outside staging dir", "OUT_OF_STAGING");
                return;
            }
            if (target.exists()) {
                // Ignore the boolean — second-call success is the same as ENOENT.
                target.delete();
            }
            JSObject ret = new JSObject();
            ret.put("deleted", true);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("Failed to delete staged file: " + t.getMessage(), "DELETE_FAILED", t);
        }
    }
}
