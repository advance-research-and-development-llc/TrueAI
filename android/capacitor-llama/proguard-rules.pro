# Keep Capacitor plugin entry points so reflection-based dispatch from
# the Capacitor bridge keeps working in release builds.
-keep class com.trueai.llama.LlamaPlugin { *; }
-keep class com.trueai.llama.LlamaBridge { *; }

# Keep JNI native-method signatures discoverable.
-keepclasseswithmembernames class com.trueai.llama.LlamaBridge {
    native <methods>;
}
