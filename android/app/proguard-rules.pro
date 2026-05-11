# android/app/proguard-rules.pro

# ── React Native ──────────────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# ── OpenCV ────────────────────────────────────────────────────────────────────
-keep class org.opencv.** { *; }

# ── MarkerScan native module ──────────────────────────────────────────────────
-keep class com.markerscan.MarkerProcessorModule { *; }
-keep class com.markerscan.MarkerProcessorPackage { *; }

# ── Kotlin coroutines ─────────────────────────────────────────────────────────
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}
