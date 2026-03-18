package com.neuralcommander.modules

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*
import com.neuralcommander.services.AppLockOverlayService
import com.neuralcommander.services.NeuralCommanderAccessibilityService

/**
 * NeuralCommanderModule
 * =====================
 * React Native Native Module exposing Android system capabilities to JS.
 *
 * Exposed methods (callable from React Native):
 *   - enableFocusMode(difficulty: Int)
 *   - disableFocusMode()
 *   - lockApp(packageName: String, difficulty: Int)
 *   - unlockApp()
 *   - setCurrentUser(userId: Int)
 *   - checkPermissions(promise: Promise)
 */
class NeuralCommanderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val REQUEST_DEVICE_ADMIN = 1001
    }

    override fun getName(): String = "NeuralCommanderModule"

    // ------------------------------------------------------------------
    // Focus Mode
    // ------------------------------------------------------------------

    @ReactMethod
    fun enableFocusMode(difficulty: Int, promise: Promise) {
        NeuralCommanderAccessibilityService.focusModeActive = true
        promise.resolve("Focus mode enabled with difficulty $difficulty")
    }

    @ReactMethod
    fun disableFocusMode(promise: Promise) {
        NeuralCommanderAccessibilityService.focusModeActive = false
        AppLockOverlayService.stop(reactApplicationContext)
        promise.resolve("Focus mode disabled")
    }

    // ------------------------------------------------------------------
    // App Locking
    // ------------------------------------------------------------------

    @ReactMethod
    fun lockApp(packageName: String, difficulty: Int, promise: Promise) {
        try {
            AppLockOverlayService.start(reactApplicationContext, packageName, difficulty)
            promise.resolve("Overlay started for $packageName")
        } catch (e: Exception) {
            promise.reject("LOCK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun unlockApp(promise: Promise) {
        AppLockOverlayService.stop(reactApplicationContext)
        promise.resolve("App unlocked")
    }

    // ------------------------------------------------------------------
    // User Identity
    // ------------------------------------------------------------------

    @ReactMethod
    fun setCurrentUser(userId: Int, promise: Promise) {
        NeuralCommanderAccessibilityService.currentUserId = userId
        promise.resolve("User set to $userId")
    }

    // ------------------------------------------------------------------
    // Permission Checks
    // ------------------------------------------------------------------

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val ctx = reactApplicationContext
        val map = WritableNativeMap()

        map.putBoolean(
            "canDrawOverlays",
            android.provider.Settings.canDrawOverlays(ctx),
        )

        val accessibilityEnabled = try {
            android.provider.Settings.Secure.getInt(
                ctx.contentResolver,
                android.provider.Settings.Secure.ACCESSIBILITY_ENABLED,
            ) == 1
        } catch (_: Exception) {
            false
        }
        map.putBoolean("accessibilityEnabled", accessibilityEnabled)

        val dpm = ctx.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(ctx, NeuralCommanderDeviceAdmin::class.java)
        map.putBoolean("isDeviceAdmin", dpm.isAdminActive(adminComponent))

        promise.resolve(map)
    }

    // ------------------------------------------------------------------
    // Device Policy (optional: remote lock screen)
    // ------------------------------------------------------------------

    @ReactMethod
    fun lockScreen(promise: Promise) {
        val ctx = reactApplicationContext
        val dpm = ctx.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(ctx, NeuralCommanderDeviceAdmin::class.java)
        return if (dpm.isAdminActive(adminComponent)) {
            dpm.lockNow()
            promise.resolve("Screen locked")
        } else {
            promise.reject("NO_ADMIN", "Device admin not active")
        }
    }
}
