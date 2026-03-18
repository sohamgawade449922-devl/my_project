package com.neuralcommander.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * NeuralCommanderAccessibilityService
 * ====================================
 * Uses Android AccessibilityService to:
 *  1. Intercept incoming notifications from social apps (WhatsApp, Instagram, etc.)
 *  2. Forward them to the NeuralCommander backend for AI classification.
 *  3. When Focus Mode is active, suppress notifications and send AI auto-replies.
 */
class NeuralCommanderAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "NC_Accessibility"
        private const val BACKEND_URL = "http://10.0.2.2:8000"  // localhost from emulator
        private val SOCIAL_PACKAGES = setOf(
            "com.whatsapp",
            "com.instagram.android",
            "com.snapchat.android",
            "com.twitter.android",
            "com.facebook.katana",
        )
        var focusModeActive = false
        var currentUserId = 1
    }

    private val http = OkHttpClient()
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onServiceConnected() {
        super.onServiceConnected()
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED or
                         AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 100
        }
        serviceInfo = info
        Log.i(TAG, "NeuralCommander Accessibility Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED) return

        val packageName = event.packageName?.toString() ?: return
        if (packageName !in SOCIAL_PACKAGES && !packageName.contains("classroom")) return

        val parcelable = event.parcelableData
        val title = event.text.firstOrNull()?.toString() ?: ""
        val body = if (event.text.size > 1) event.text.drop(1).joinToString(" ") else ""

        Log.d(TAG, "Notification intercepted: pkg=$packageName title=$title")

        scope.launch {
            forwardNotificationToBackend(packageName, title, body)
        }
    }

    private fun forwardNotificationToBackend(
        packageName: String,
        title: String,
        body: String,
    ) {
        val json = JSONObject().apply {
            put("package_name", packageName)
            put("title", title)
            put("body", body)
        }
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = json.toString().toRequestBody(mediaType)
        val request = Request.Builder()
            .url("$BACKEND_URL/api/v1/notifications/$currentUserId")
            .post(requestBody)
            .build()
        try {
            http.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val respBody = response.body?.string() ?: return
                    val respJson = JSONObject(respBody)
                    val suppressed = respJson.optBoolean("was_suppressed", false)
                    val aiReply = if (respJson.has("ai_reply") && !respJson.isNull("ai_reply"))
                        respJson.getString("ai_reply") else null

                    Log.d(TAG, "Backend response – suppressed=$suppressed aiReply=$aiReply")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to forward notification: ${e.message}")
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility Service interrupted")
    }
}
