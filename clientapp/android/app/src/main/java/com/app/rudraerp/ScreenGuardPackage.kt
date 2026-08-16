package com.app.rudraerp

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

/**
 * Registers ScreenGuardModule. Added by hand in MainApplication.getPackages()
 * because this module lives in the app itself, so there is no npm package for
 * autolinking to find.
 *
 * ── Why BaseReactPackage and not a plain ReactPackage ───────────────────────
 * This app runs the New Architecture (android/gradle.properties →
 * newArchEnabled=true). On that path `ReactPackage.createNativeModules` is
 * deprecated and BaseReactPackage's own override throws
 * UnsupportedOperationException — module lookup goes through `getModule` plus
 * a ReactModuleInfoProvider instead, which also gets us lazy instantiation.
 *
 * `isTurboModule = false` is correct and deliberate: ScreenGuardModule is a
 * classic ReactContextBaseJavaModule with no codegen spec, so it is loaded
 * through the interop layer. Claiming true here would make the runtime look
 * for a generated TurboModule spec that does not exist.
 */
class ScreenGuardPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == ScreenGuardModule.NAME) ScreenGuardModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        ScreenGuardModule.NAME to
            ReactModuleInfo(
                /* name = */ ScreenGuardModule.NAME,
                // The real FQCN, not the JS-facing name — this is what the
                // registry reflects on.
                /* className = */ ScreenGuardModule::class.java.name,
                /* canOverrideExistingModule = */ false,
                /* needsEagerInit = */ false,
                /* isCxxModule = */ false,
                /* isTurboModule = */ false,
            )
    )
  }

  // Abstract on the ReactPackage interface, so it must be implemented even
  // though this package ships no views. The generic bound is
  // `ViewManager<in Nothing, in Nothing>` in RN 0.84 — NOT `ViewManager<*, *>`,
  // which fails to override.
  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<in Nothing, in Nothing>> = emptyList()
}
