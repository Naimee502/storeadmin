package com.rnupgrade

import android.app.Activity
import android.content.Intent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.google.android.play.core.install.model.ActivityResult

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "RNUpgrade"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Handle the result of the In-App Update flow.
   *
   * For IMMEDIATE updates: if the user presses back (RESULT_CANCELED) we
   * finish the activity so they cannot use an outdated version.
   *
   * For FLEXIBLE updates: the download proceeds in the background and the
   * JS layer handles the completion via the status listener.
   *
   * REQUEST_CODE 0 is the default used by sp-react-native-in-app-updates.
   */
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode == 0) {
      when (resultCode) {
        // User accepted the update — update will proceed automatically
        Activity.RESULT_OK -> Unit

        // User cancelled an IMMEDIATE update — close the app to enforce the update
        Activity.RESULT_CANCELED -> finish()

        // Update failed (e.g. no network) — silently ignore; will retry next launch
        ActivityResult.RESULT_IN_APP_UPDATE_FAILED -> Unit
      }
    }
  }
}
