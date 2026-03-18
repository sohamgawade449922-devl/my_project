package com.neuralcommander.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.core.app.NotificationCompat
import com.neuralcommander.R
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * AppLockOverlayService
 * =====================
 * Draws a full-screen TYPE_APPLICATION_OVERLAY window that prevents
 * the user from interacting with a locked app (e.g. Instagram) during
 * a focus session.
 *
 * Lock Difficulty Levels
 * ----------------------
 *  1 – simple dismiss button
 *  2 – 5-second countdown before dismiss button appears
 *  3 – math challenge required to dismiss
 *  4 – 30-second countdown + math challenge
 *  5 – no dismiss available; only ends when focus session ends
 */
class AppLockOverlayService : Service() {

    companion object {
        private const val TAG = "AppLockOverlay"
        private const val CHANNEL_ID = "nc_focus_channel"
        private const val NOTIF_ID = 101
        private const val BACKEND_URL = "http://10.0.2.2:8000"
        const val EXTRA_PACKAGE = "locked_package"
        const val EXTRA_DIFFICULTY = "lock_difficulty"

        fun start(context: Context, packageName: String, difficulty: Int) {
            val intent = Intent(context, AppLockOverlayService::class.java).apply {
                putExtra(EXTRA_PACKAGE, packageName)
                putExtra(EXTRA_DIFFICULTY, difficulty)
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, AppLockOverlayService::class.java))
        }
    }

    private var overlayView: View? = null
    private lateinit var windowManager: WindowManager

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val packageName = intent?.getStringExtra(EXTRA_PACKAGE) ?: "unknown"
        val difficulty = intent?.getIntExtra(EXTRA_DIFFICULTY, 1) ?: 1
        startForeground(NOTIF_ID, buildForegroundNotification(packageName))
        showOverlay(packageName, difficulty)
        return START_NOT_STICKY
    }

    private fun showOverlay(packageName: String, difficulty: Int) {
        removeOverlay()

        val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
        }

        val inflater = LayoutInflater.from(this)
        val view = inflater.inflate(R.layout.overlay_app_lock, null)
        setupOverlayContent(view, packageName, difficulty)

        try {
            windowManager.addView(view, params)
            overlayView = view
            Log.i(TAG, "Overlay shown for $packageName (difficulty=$difficulty)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to add overlay: ${e.message}")
        }
    }

    private fun setupOverlayContent(view: View, packageName: String, difficulty: Int) {
        view.findViewById<TextView>(R.id.tv_lock_message)?.text =
            "🔒 Focus Mode Active\nStop procrastinating – get back to work!"

        val dismissBtn = view.findViewById<Button>(R.id.btn_dismiss)
        when (difficulty) {
            5 -> dismissBtn?.visibility = View.GONE
            4, 3 -> {
                dismissBtn?.isEnabled = false
                dismissBtn?.text = "Solve to unlock"
                dismissBtn?.setOnClickListener { presentMathChallenge(view, difficulty) }
                if (difficulty == 4) startCountdown(dismissBtn, 30)
                else dismissBtn?.isEnabled = true
            }
            2 -> startCountdown(dismissBtn, 5)
            else -> dismissBtn?.setOnClickListener { removeOverlayAndStop() }
        }
    }

    private fun presentMathChallenge(view: View, difficulty: Int) {
        val a = (10..99).random()
        val b = (10..99).random()
        val answer = a + b
        view.findViewById<TextView>(R.id.tv_lock_message)?.text =
            "Solve to dismiss:\n$a + $b = ?"
        // Make the answer input visible
        val editText = view.findViewById<android.widget.EditText>(R.id.et_answer)
        editText?.visibility = View.VISIBLE
        view.findViewById<Button>(R.id.btn_dismiss)?.apply {
            isEnabled = true
            setOnClickListener {
                if (editText?.text?.toString()?.trim()?.toIntOrNull() == answer) {
                    reportBypass()
                    removeOverlayAndStop()
                } else {
                    editText?.error = "Wrong! Try again."
                }
            }
        }
    }

    private fun startCountdown(button: Button?, seconds: Int) {
        button?.isEnabled = false
        val handler = android.os.Handler(mainLooper)
        var remaining = seconds
        val runnable = object : Runnable {
            override fun run() {
                if (remaining > 0) {
                    button?.text = "Wait ${remaining}s…"
                    remaining--
                    handler.postDelayed(this, 1000)
                } else {
                    button?.isEnabled = true
                    button?.text = "Dismiss (bypass)"
                    button?.setOnClickListener {
                        reportBypass()
                        removeOverlayAndStop()
                    }
                }
            }
        }
        handler.post(runnable)
    }

    private fun reportBypass() {
        Log.w(TAG, "User bypassed app lock – reporting to backend")
        val sessionId = getSharedPreferences("nc_prefs", Context.MODE_PRIVATE)
            .getInt("active_focus_session_id", -1)
        if (sessionId == -1) return
        val request = Request.Builder()
            .url("$BACKEND_URL/api/v1/focus/$sessionId/bypass")
            .post(ByteArray(0).toRequestBody(null, 0, 0))
            .build()
        try {
            OkHttpClient().newCall(request).execute().close()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to report bypass: ${e.message}")
        }
    }

    private fun removeOverlayAndStop() {
        removeOverlay()
        stopSelf()
    }

    private fun removeOverlay() {
        overlayView?.let {
            try {
                windowManager.removeView(it)
            } catch (e: Exception) {
                Log.w(TAG, "Could not remove overlay: ${e.message}")
            }
            overlayView = null
        }
    }

    private fun buildForegroundNotification(packageName: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Focus Mode Active")
            .setContentText("$packageName is locked during your study session.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Focus Mode",
                NotificationManager.IMPORTANCE_LOW,
            )
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        removeOverlay()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
