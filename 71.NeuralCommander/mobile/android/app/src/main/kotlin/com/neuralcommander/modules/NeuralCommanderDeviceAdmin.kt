package com.neuralcommander.modules

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * DeviceAdminReceiver required by DevicePolicyManager.
 * Declared in AndroidManifest.xml with BIND_DEVICE_ADMIN permission.
 */
class NeuralCommanderDeviceAdmin : DeviceAdminReceiver() {
    companion object {
        private const val TAG = "NC_DeviceAdmin"
    }

    override fun onEnabled(context: Context, intent: Intent) {
        Log.i(TAG, "Device admin enabled")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        Log.w(TAG, "Device admin disabled")
    }

    override fun onPasswordFailed(context: Context, intent: Intent) {
        Log.w(TAG, "Password attempt failed")
    }
}
