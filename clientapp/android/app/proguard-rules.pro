# ProGuard / R8 rules for the release bundle.
#
# minifyEnabled and shrinkResources are both on (app/build.gradle), so anything
# reached only by reflection has to be named here or R8 will delete it and the
# app will fail at runtime — not at build time, which is what makes this file
# worth reading before every Play upload.
#
# React Native's own gradle plugin contributes the core RN, Hermes and
# TurboModule rules automatically, and a library that ships
# consumerProguardFiles in its AAR brings its own. Everything below covers the
# libraries in this app that do NOT: checked one by one against node_modules,
# not copied from a template.

# ── Keep line numbers, drop the source file name ───────────────────────────
# A stack trace from Play Console is unreadable without line numbers; the file
# name is what leaks source layout, so only that is renamed.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Annotations, generics and exceptions — reflection and Gson-style parsing all
# depend on these surviving.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions

# ── React Native native modules ────────────────────────────────────────────
# Found by name from JavaScript, so the class and its bridge entry points can
# never be renamed.
-keep,includedescriptorclasses class com.facebook.react.bridge.** { *; }
-keep,includedescriptorclasses class com.facebook.react.turbomodule.** { *; }
-keep class * implements com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class * extends com.facebook.react.uimanager.ViewManager { *; }
-keep class * implements com.facebook.react.ReactPackage { *; }
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}
-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; }
-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }

# This app's own native package and module registrations.
-keep class com.app.rudraerp.** { *; }

# ── Glide, via react-native-fast-image ─────────────────────────────────────
# Ships no consumer rules of its own. Glide discovers modules by reflection, so
# a stripped module means images silently never load.
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep public class * extends com.bumptech.glide.module.AppGlideModule
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** { **[] $VALUES; public *; }
-keep class com.dylanvann.fastimage.** { *; }
-keep interface com.dylanvann.fastimage.** { *; }
-dontwarn com.bumptech.glide.**

# ── In-app updates (sp-react-native-in-app-updates -> Play Core) ───────────
-keep class com.google.android.play.core.** { *; }
-keep class com.google.android.play.** { *; }
-dontwarn com.google.android.play.core.**

# ── Firebase messaging + Notifee ───────────────────────────────────────────
# Notifee ships its own rules; Firebase's service and model classes are named
# in the manifest and instantiated reflectively.
-keep class com.google.firebase.** { *; }
-keep class io.invertase.firebase.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── Screens, gesture handler, safe-area, flash-list, webview, svg ──────────
# None of these ship consumer rules; all register view managers by name.
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.shopify.reactnative.flash_list.** { *; }
-keep class com.reactnativecommunity.webview.** { *; }
-keep class com.horcrux.svg.** { *; }
-keep class com.BV.LinearGradient.** { *; }
-keep class com.oblador.vectoricons.** { *; }
-keep class com.imagepicker.** { *; }
-keep class com.zoontek.rnpermissions.** { *; }
-keep class com.learnium.RNDeviceInfo.** { *; }
-keep class com.reactnativecommunity.geolocation.** { *; }

# ── OkHttp / Okio ──────────────────────────────────────────────────────────
# Bundled with React Native. These warnings are about optional platform code
# that is never on an Android classpath; without the -dontwarn the build fails.
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ── Kotlin coroutines / metadata ───────────────────────────────────────────
-dontwarn kotlinx.coroutines.**
-keepclassmembers class kotlin.Metadata { public <methods>; }

# ── Hermes ─────────────────────────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
