package com.app.rudraerp

import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Android screen-capture blocking, driven by Business Settings →
 * Screen Capture Protection → "Mobile app".
 *
 * FLAG_SECURE is the real thing, not a deterrent: the OS refuses to put this
 * window into a screenshot, a screen recording, or a screen-share stream, and
 * shows black instead. It is enforced by the window manager, so no JS-level
 * bug or hooked library can quietly defeat it. It also hides the app's preview
 * in the recent-apps switcher, which is a nice side effect for a POS.
 *
 * Why this is a runtime toggle rather than a line in MainActivity.onCreate:
 * the owner still needs to demo the product themselves. Turning the setting
 * off has to actually restore capture, so both directions must be callable.
 *
 * Threading: window flags may only be touched on the UI thread — calling from
 * the JS thread throws CalledFromWrongThreadException. Hence runOnUiThread.
 */
class ScreenGuardModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun setSecure(enabled: Boolean, promise: Promise) {
    // NOT the inherited `currentActivity`: on ReactContextBaseJavaModule that
    // is a Kotlin `fun getCurrentActivity()`, and Kotlin only synthesises
    // property access for JAVA getters — so `currentActivity` does not resolve
    // here. It is deprecated since RN 0.80 anyway, and its own ReplaceWith
    // points at exactly this. ReactContext.getCurrentActivity() IS Java, so the
    // synthetic property works on reactApplicationContext.
    val activity = reactApplicationContext.currentActivity
    // No activity yet (app backgrounded, or called before the first render).
    // Resolve false rather than reject: the JS side re-applies on every
    // foreground and on every settings change, so this self-heals.
    if (activity == null) {
      promise.resolve(false)
      return
    }

    activity.runOnUiThread {
      try {
        if (enabled) {
          activity.window.setFlags(
              WindowManager.LayoutParams.FLAG_SECURE,
              WindowManager.LayoutParams.FLAG_SECURE
          )
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("SCREENGUARD_ERROR", e.message, e)
      }
    }
  }

  /** Lets the JS layer report honestly what protection is available here. */
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun isFullyEnforced(): Boolean = true

  companion object {
    const val NAME = "ScreenGuard"
  }
}
