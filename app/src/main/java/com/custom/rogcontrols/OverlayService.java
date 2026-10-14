package com.custom.rogcontrols;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import java.util.HashMap;
import java.util.Map;

/**
 * Core AccessibilityService implementing:
 * 1. WindowManager overlay for floating ROG Handheld gamepad HUD
 * 2. Edit Mode vs Play Mode keymapping mechanics
 * 3. Connecting lines Canvas linking buttons to Target Pointers in Edit Mode
 * 4. Multi-stroke GestureDescription touch synthesis engine (zero root required)
 * 5. High-frequency analog drag gesture injection with willContinue chaining
 */
public class OverlayService extends AccessibilityService {

    public static final String ACTION_START_OVERLAY = "com.custom.rogcontrols.ACTION_START";
    public static final String ACTION_STOP_OVERLAY = "com.custom.rogcontrols.ACTION_STOP";

    private WindowManager mWindowManager;
    private ConfigManager mConfigManager;
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());

    // Root Overlays
    private FrameLayout mHudRootLayout;
    private ConnectingLinesCanvas mLinesCanvas;
    private LinearLayout mTopDockBar;
    private LinearLayout mSettingsPanel;

    // Joysticks
    private JoystickView mLeftJoystick;
    private JoystickView mRightJoystick;
    private View mAimAnchorPointer;
    private View mMovementAnchorPointer;

    // Dynamic Button views and their paired Target Pointer Views
    private final Map<String, View> mConsoleButtons = new HashMap<>();
    private final Map<String, View> mTargetPointers = new HashMap<>();

    // Continuous gesture tracking for Left & Right Analog sticks
    private GestureDescription.StrokeDescription mLeftStickStroke = null;
    private GestureDescription.StrokeDescription mRightStickStroke = null;
    private float mLastRightTargetX = 0f;
    private float mLastRightTargetY = 0f;

    // View holding connecting lines in Edit Mode
    private class ConnectingLinesCanvas extends View {
        private final Paint mLinePaint;
        private final Paint mDotPaint;

        public ConnectingLinesCanvas(Context context) {
            super(context);
            mLinePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            mLinePaint.setStyle(Paint.Style.STROKE);
            mLinePaint.setStrokeWidth(3f);
            mLinePaint.setColor(Color.parseColor("#00E5FF"));
            mLinePaint.setPathEffect(new DashPathEffect(new float[]{15, 10}, 0));

            mDotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            mDotPaint.setStyle(Paint.Style.FILL);
            mDotPaint.setColor(Color.parseColor("#FF003F"));
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            ConfigManager.AppConfig config = mConfigManager.getConfig();
            if (!config.isEditMode) return;

            // Draw line for each button to its target pointer
            for (Map.Entry<String, ConfigManager.NodePoint> entry : config.buttonPositions.entrySet()) {
                String btnKey = entry.getKey();
                ConfigManager.NodePoint btnPoint = entry.getValue();
                ConfigManager.NodePoint targetPoint = config.targetPointers.get(btnKey);

                if (targetPoint != null) {
                    canvas.drawLine(btnPoint.x, btnPoint.y, targetPoint.x, targetPoint.y, mLinePaint);
                    canvas.drawCircle(btnPoint.x, btnPoint.y, 6f, mDotPaint);
                    canvas.drawCircle(targetPoint.x, targetPoint.y, 6f, mDotPaint);
                }
            }

            // Draw line for Right Stick to Aim Anchor
            canvas.drawLine(
                    config.rightStickPos.x, config.rightStickPos.y,
                    config.rightStickAnchor.x, config.rightStickAnchor.y,
                    mLinePaint
            );
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        mWindowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        mConfigManager = ConfigManager.getInstance(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP_OVERLAY.equals(action)) {
                removeHudOverlay();
                stopSelf();
                return START_NOT_STICKY;
            }
        }
        initHudOverlay();
        return START_STICKY;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Not used for input synthesis, kept lightweight
    }

    @Override
    public void onInterrupt() {
        removeHudOverlay();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        removeHudOverlay();
    }

    /**
     * Initializes the full-screen floating HUD overlay layout using TYPE_APPLICATION_OVERLAY.
     */
    private void initHudOverlay() {
        if (mHudRootLayout != null) return;

        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        WindowManager.LayoutParams rootParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                overlayType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
        );
        rootParams.gravity = Gravity.TOP | Gravity.START;

        mHudRootLayout = new FrameLayout(this);
        mHudRootLayout.setBackgroundColor(Color.TRANSPARENT);

        // 1. Connecting lines background view
        mLinesCanvas = new ConnectingLinesCanvas(this);
        mHudRootLayout.addView(mLinesCanvas, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // 2. Build Joysticks
        buildJoysticks();

        // 3. Build Action Buttons and Target Pointers
        buildButtonsAndPointers();

        // 4. Build Floating Top Control Dock & Settings Panel
        buildTopDock();

        // Apply Opacity & Mode
        updateOverlayOpacity(mConfigManager.getConfig().overlayOpacity);
        updateModeVisuals(mConfigManager.getConfig().isEditMode);

        mWindowManager.addView(mHudRootLayout, rootParams);
    }

    private void removeHudOverlay() {
        if (mHudRootLayout != null && mWindowManager != null) {
            try {
                mWindowManager.removeView(mHudRootLayout);
            } catch (Exception ignored) {}
            mHudRootLayout = null;
        }
    }

    /**
     * Creates Left Movement and Right Camera Analog Thumbsticks.
     */
    private void buildJoysticks() {
        ConfigManager.AppConfig config = mConfigManager.getConfig();

        // --- Left Analog Joystick ---
        mLeftJoystick = new JoystickView(this);
        mLeftJoystick.setRightStick(false);
        mLeftJoystick.setDeadzoneRatio(config.deadzoneRatio);
        mLeftJoystick.setSensitivity(1.0f, 1.0f);
        mLeftJoystick.setAimAnchor(config.leftStickAnchor.x, config.leftStickAnchor.y);

        FrameLayout.LayoutParams leftLp = new FrameLayout.LayoutParams(340, 340);
        leftLp.leftMargin = (int) (config.leftStickPos.x - 170);
        leftLp.topMargin = (int) (config.leftStickPos.y - 170);
        mHudRootLayout.addView(mLeftJoystick, leftLp);
        attachDraggable(mLeftJoystick, config.leftStickPos, null);

        // Movement In-Game Anchor Target Indicator
        mMovementAnchorPointer = createPointerView("🎮 MOVE", Color.parseColor("#00E5FF"));
        FrameLayout.LayoutParams leftAnchorLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        leftAnchorLp.leftMargin = (int) config.leftStickAnchor.x - 40;
        leftAnchorLp.topMargin = (int) config.leftStickAnchor.y - 40;
        mHudRootLayout.addView(mMovementAnchorPointer, leftAnchorLp);
        attachDraggable(mMovementAnchorPointer, config.leftStickAnchor, null);

        mLeftJoystick.setOnJoystickMoveListener(new JoystickView.OnJoystickMoveListener() {
            @Override
            public void onMoved(float deltaX, float deltaY, float normX, float normY, float targetX, float targetY) {
                if (mConfigManager.getConfig().isEditMode) return;
                injectContinuousDragGesture(
                        config.leftStickAnchor.x, config.leftStickAnchor.y,
                        targetX, targetY, true
                );
            }

            @Override
            public void onReleased() {
                mLeftStickStroke = null;
            }
        });

        // --- Right Analog Joystick (BlueStacks X/Y Sensitivity Engine) ---
        mRightJoystick = new JoystickView(this);
        mRightJoystick.setRightStick(true);
        mRightJoystick.setDeadzoneRatio(config.deadzoneRatio);
        mRightJoystick.setSensitivity(config.rightStickSensX, config.rightStickSensY);
        mRightJoystick.setAimAnchor(config.rightStickAnchor.x, config.rightStickAnchor.y);

        FrameLayout.LayoutParams rightLp = new FrameLayout.LayoutParams(340, 340);
        rightLp.leftMargin = (int) (config.rightStickPos.x - 170);
        rightLp.topMargin = (int) (config.rightStickPos.y - 170);
        mHudRootLayout.addView(mRightJoystick, rightLp);
        attachDraggable(mRightJoystick, config.rightStickPos, null);

        // Aim Camera In-Game Anchor Target Indicator
        mAimAnchorPointer = createPointerView("🎯 AIM ANCHOR", Color.parseColor("#FF003F"));
        FrameLayout.LayoutParams rightAnchorLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        rightAnchorLp.leftMargin = (int) config.rightStickAnchor.x - 60;
        rightAnchorLp.topMargin = (int) config.rightStickAnchor.y - 30;
        mHudRootLayout.addView(mAimAnchorPointer, rightAnchorLp);
        attachDraggable(mAimAnchorPointer, config.rightStickAnchor, () -> {
            mRightJoystick.setAimAnchor(config.rightStickAnchor.x, config.rightStickAnchor.y);
        });

        mRightJoystick.setOnJoystickMoveListener(new JoystickView.OnJoystickMoveListener() {
            @Override
            public void onMoved(float deltaX, float deltaY, float normX, float normY, float targetX, float targetY) {
                if (mConfigManager.getConfig().isEditMode) return;
                injectContinuousDragGesture(
                        config.rightStickAnchor.x, config.rightStickAnchor.y,
                        targetX, targetY, false
                );
            }

            @Override
            public void onReleased() {
                mRightStickStroke = null;
            }
        });
    }

    /**
     * Builds Action Buttons (A, B, X, Y, L1, R1, D-Pads) and their paired Target Pointer Nodes.
     */
    private void buildButtonsAndPointers() {
        ConfigManager.AppConfig config = mConfigManager.getConfig();

        for (Map.Entry<String, ConfigManager.NodePoint> entry : config.buttonPositions.entrySet()) {
            final String btnKey = entry.getKey();
            final ConfigManager.NodePoint btnPos = entry.getValue();
            final ConfigManager.NodePoint targetPos = config.targetPointers.get(btnKey);

            // 1. Console Button View
            Button btnView = new Button(this);
            btnView.setText(getDisplayLabelForKey(btnKey));
            btnView.setTextColor(Color.WHITE);
            btnView.setTextSize(14f);

            GradientDrawable btnBg = new GradientDrawable();
            btnBg.setShape(GradientDrawable.OVAL);
            btnBg.setColor(Color.parseColor("#D9151A24"));
            btnBg.setStroke(3, Color.parseColor(btnKey.startsWith("BTN_") ? "#FF003F" : "#00E5FF"));
            btnView.setBackground(btnBg);

            int btnSize = btnKey.startsWith("BTN_L") || btnKey.startsWith("BTN_R") ? 130 : 120;
            FrameLayout.LayoutParams btnLp = new FrameLayout.LayoutParams(btnSize, btnSize);
            btnLp.leftMargin = (int) (btnPos.x - btnSize / 2f);
            btnLp.topMargin = (int) (btnPos.y - btnSize / 2f);
            mHudRootLayout.addView(btnView, btnLp);
            mConsoleButtons.put(btnKey, btnView);

            // 2. Paired Target Pointer View
            View pointerView = createPointerView("🎯 " + getDisplayLabelForKey(btnKey), Color.parseColor("#00E5FF"));
            FrameLayout.LayoutParams ptrLp = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
            );
            if (targetPos != null) {
                ptrLp.leftMargin = (int) targetPos.x - 40;
                ptrLp.topMargin = (int) targetPos.y - 30;
            }
            mHudRootLayout.addView(pointerView, ptrLp);
            mTargetPointers.put(btnKey, pointerView);

            // Button touch listener in Play Mode vs Drag in Edit Mode
            attachButtonBehavior(btnView, btnPos, targetPos, btnKey);
            if (targetPos != null) {
                attachDraggable(pointerView, targetPos, null);
            }
        }
    }

    private String getDisplayLabelForKey(String key) {
        switch (key) {
            case "BTN_A": return "A";
            case "BTN_B": return "B";
            case "BTN_X": return "X";
            case "BTN_Y": return "Y";
            case "BTN_L1": return "L1";
            case "BTN_R1": return "R1";
            case "DPAD_UP": return "▲";
            case "DPAD_DOWN": return "▼";
            default: return key.replace("BTN_", "");
        }
    }

    private View createPointerView(String label, int strokeColor) {
        TextView tv = new TextView(this);
        tv.setText(label);
        tv.setTextSize(10f);
        tv.setTextColor(Color.WHITE);
        tv.setPadding(14, 8, 14, 8);

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setCornerRadius(16f);
        bg.setColor(Color.parseColor("#CC0B0F19"));
        bg.setStroke(2, strokeColor);
        tv.setBackground(bg);
        return tv;
    }

    /**
     * Attaches dragging behavior in Edit Mode and instant synthetic touch injection in Play Mode.
     */
    private void attachButtonBehavior(final View view, final ConfigManager.NodePoint btnPos,
                                      final ConfigManager.NodePoint targetPos, final String key) {
        view.setOnTouchListener(new View.OnTouchListener() {
            private float dX, dY;
            private boolean isClick = true;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                ConfigManager.AppConfig config = mConfigManager.getConfig();

                if (config.isEditMode) {
                    switch (event.getActionMasked()) {
                        case MotionEvent.ACTION_DOWN:
                            dX = v.getX() - event.getRawX();
                            dY = v.getY() - event.getRawY();
                            isClick = true;
                            return true;

                        case MotionEvent.ACTION_MOVE:
                            float newX = event.getRawX() + dX;
                            float newY = event.getRawY() + dY;
                            v.setX(newX);
                            v.setY(newY);
                            btnPos.x = newX + v.getWidth() / 2f;
                            btnPos.y = newY + v.getHeight() / 2f;
                            mLinesCanvas.invalidate();
                            isClick = false;
                            return true;

                        case MotionEvent.ACTION_UP:
                            mConfigManager.save();
                            return true;
                    }
                } else {
                    // Play Mode: Synthesize instant tap at paired Target Pointer Coordinates
                    switch (event.getActionMasked()) {
                        case MotionEvent.ACTION_DOWN:
                            v.setAlpha(0.6f);
                            if (targetPos != null) {
                                injectFastTapGesture(targetPos.x, targetPos.y);
                            }
                            return true;

                        case MotionEvent.ACTION_UP:
                        case MotionEvent.ACTION_CANCEL:
                            v.setAlpha(1.0f);
                            return true;
                    }
                }
                return false;
            }
        });
    }

    /**
     * Makes any target pointer or joystick anchor draggable in Edit Mode.
     */
    private void attachDraggable(final View view, final ConfigManager.NodePoint modelPoint, final Runnable onMovedCallback) {
        view.setOnTouchListener(new View.OnTouchListener() {
            private float dX, dY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (!mConfigManager.getConfig().isEditMode) return false;

                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        dX = v.getX() - event.getRawX();
                        dY = v.getY() - event.getRawY();
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        float newX = event.getRawX() + dX;
                        float newY = event.getRawY() + dY;
                        v.setX(newX);
                        v.setY(newY);

                        modelPoint.x = newX + v.getWidth() / 2f;
                        modelPoint.y = newY + v.getHeight() / 2f;
                        mLinesCanvas.invalidate();

                        if (onMovedCallback != null) {
                            onMovedCallback.run();
                        }
                        return true;

                    case MotionEvent.ACTION_UP:
                        mConfigManager.save();
                        return true;
                }
                return false;
            }
        });
    }

    /**
     * Builds the top HUD control dock and collapsible sensitivity settings dialog.
     */
    private void buildTopDock() {
        mTopDockBar = new LinearLayout(this);
        mTopDockBar.setOrientation(LinearLayout.HORIZONTAL);
        mTopDockBar.setGravity(Gravity.CENTER_VERTICAL);
        mTopDockBar.setPadding(24, 12, 24, 12);

        GradientDrawable dockBg = new GradientDrawable();
        dockBg.setCornerRadius(24f);
        dockBg.setColor(Color.parseColor("#E60B0E17"));
        dockBg.setStroke(2, Color.parseColor("#FF003F"));
        mTopDockBar.setBackground(dockBg);

        // Mode Toggle Button
        final Button btnModeToggle = new Button(this);
        btnModeToggle.setText("🔒 PLAY MODE");
        btnModeToggle.setTextSize(11f);
        btnModeToggle.setTextColor(Color.WHITE);
        btnModeToggle.setBackgroundColor(Color.TRANSPARENT);

        btnModeToggle.setOnClickListener(v -> {
            boolean newMode = !mConfigManager.getConfig().isEditMode;
            mConfigManager.getConfig().isEditMode = newMode;
            mConfigManager.save();
            btnModeToggle.setText(newMode ? "⚙️ EDIT MODE" : "🔒 PLAY MODE");
            btnModeToggle.setTextColor(newMode ? Color.parseColor("#FF003F") : Color.WHITE);
            updateModeVisuals(newMode);
            Toast.makeText(this, newMode ? "Edit Mode: Drag buttons and target pointers" : "Play Mode: Touch injection active", Toast.LENGTH_SHORT).show();
        });

        // Settings Dialog Button
        Button btnSettings = new Button(this);
        btnSettings.setText("⚙ SENSITIVITY");
        btnSettings.setTextSize(11f);
        btnSettings.setTextColor(Color.parseColor("#00E5FF"));
        btnSettings.setBackgroundColor(Color.TRANSPARENT);

        btnSettings.setOnClickListener(v -> toggleSettingsPanel());

        // Close Service Button
        Button btnClose = new Button(this);
        btnClose.setText("✕ HIDE");
        btnClose.setTextSize(11f);
        btnClose.setTextColor(Color.parseColor("#94A3B8"));
        btnClose.setBackgroundColor(Color.TRANSPARENT);
        btnClose.setOnClickListener(v -> {
            removeHudOverlay();
            stopSelf();
        });

        mTopDockBar.addView(btnModeToggle);
        mTopDockBar.addView(btnSettings);
        mTopDockBar.addView(btnClose);

        FrameLayout.LayoutParams dockParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        dockParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        dockParams.topMargin = 30;
        mHudRootLayout.addView(mTopDockBar, dockParams);

        // Build Settings Dialog Panel
        buildSettingsDialog();
    }

    /**
     * Builds floating collapsible settings dialog for live X/Y sensitivity adjustments.
     */
    private void buildSettingsDialog() {
        mSettingsPanel = new LinearLayout(this);
        mSettingsPanel.setOrientation(LinearLayout.VERTICAL);
        mSettingsPanel.setPadding(28, 24, 28, 24);
        mSettingsPanel.setVisibility(View.GONE);

        GradientDrawable panelBg = new GradientDrawable();
        panelBg.setCornerRadius(16f);
        panelBg.setColor(Color.parseColor("#F20F131D"));
        panelBg.setStroke(2, Color.parseColor("#2A3144"));
        mSettingsPanel.setBackground(panelBg);

        ConfigManager.AppConfig config = mConfigManager.getConfig();

        // Title
        TextView tvTitle = new TextView(this);
        tvTitle.setText("BLUESTACKS X/Y SENSITIVITY ENGINE");
        tvTitle.setTextColor(Color.parseColor("#00E5FF"));
        tvTitle.setTextSize(12f);
        tvTitle.setPadding(0, 0, 0, 16);
        mSettingsPanel.addView(tvTitle);

        // X Sensitivity Slider (0.5x to 8.0x)
        final TextView tvSensX = new TextView(this);
        tvSensX.setText(String.format("Right Stick X-Sens: %.1fx", config.rightStickSensX));
        tvSensX.setTextColor(Color.WHITE);
        tvSensX.setTextSize(11f);
        mSettingsPanel.addView(tvSensX);

        SeekBar sbSensX = new SeekBar(this);
        sbSensX.setMax(75); // 0.5 + 7.5 = 8.0
        sbSensX.setProgress((int) ((config.rightStickSensX - 0.5f) * 10));
        sbSensX.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                float val = 0.5f + (progress / 10f);
                config.rightStickSensX = val;
                tvSensX.setText(String.format("Right Stick X-Sens: %.1fx", val));
                mRightJoystick.setSensitivity(config.rightStickSensX, config.rightStickSensY);
                mConfigManager.save();
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
        mSettingsPanel.addView(sbSensX);

        // Y Sensitivity Slider (Vertical Recoil & Drag Boost)
        final TextView tvSensY = new TextView(this);
        tvSensY.setText(String.format("Right Stick Y-Sens (Drag Boost): %.1fx", config.rightStickSensY));
        tvSensY.setTextColor(Color.parseColor("#FF003F"));
        tvSensY.setTextSize(11f);
        tvSensY.setPadding(0, 12, 0, 0);
        mSettingsPanel.addView(tvSensY);

        SeekBar sbSensY = new SeekBar(this);
        sbSensY.setMax(75);
        sbSensY.setProgress((int) ((config.rightStickSensY - 0.5f) * 10));
        sbSensY.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                float val = 0.5f + (progress / 10f);
                config.rightStickSensY = val;
                tvSensY.setText(String.format("Right Stick Y-Sens (Drag Boost): %.1fx", val));
                mRightJoystick.setSensitivity(config.rightStickSensX, config.rightStickSensY);
                mConfigManager.save();
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
        mSettingsPanel.addView(sbSensY);

        // Deadzone Slider (0% - 30%)
        final TextView tvDeadzone = new TextView(this);
        tvDeadzone.setText(String.format("Radial Deadzone: %d%%", (int) (config.deadzoneRatio * 100)));
        tvDeadzone.setTextColor(Color.parseColor("#94A3B8"));
        tvDeadzone.setTextSize(11f);
        tvDeadzone.setPadding(0, 12, 0, 0);
        mSettingsPanel.addView(tvDeadzone);

        SeekBar sbDeadzone = new SeekBar(this);
        sbDeadzone.setMax(30);
        sbDeadzone.setProgress((int) (config.deadzoneRatio * 100));
        sbDeadzone.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                config.deadzoneRatio = progress / 100f;
                tvDeadzone.setText(String.format("Radial Deadzone: %d%%", progress));
                mLeftJoystick.setDeadzoneRatio(config.deadzoneRatio);
                mRightJoystick.setDeadzoneRatio(config.deadzoneRatio);
                mConfigManager.save();
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
        mSettingsPanel.addView(sbDeadzone);

        // Overlay Opacity Slider
        final TextView tvOpacity = new TextView(this);
        tvOpacity.setText(String.format("HUD Opacity: %d%%", (int) (config.overlayOpacity * 100)));
        tvOpacity.setTextColor(Color.WHITE);
        tvOpacity.setTextSize(11f);
        tvOpacity.setPadding(0, 12, 0, 0);
        mSettingsPanel.addView(tvOpacity);

        SeekBar sbOpacity = new SeekBar(this);
        sbOpacity.setMax(90);
        sbOpacity.setProgress((int) ((config.overlayOpacity - 0.10f) * 100));
        sbOpacity.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                config.overlayOpacity = 0.10f + (progress / 100f);
                tvOpacity.setText(String.format("HUD Opacity: %d%%", (int) (config.overlayOpacity * 100)));
                updateOverlayOpacity(config.overlayOpacity);
                mConfigManager.save();
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
        mSettingsPanel.addView(sbOpacity);

        FrameLayout.LayoutParams panelParams = new FrameLayout.LayoutParams(600, FrameLayout.LayoutParams.WRAP_CONTENT);
        panelParams.gravity = Gravity.CENTER;
        mHudRootLayout.addView(mSettingsPanel, panelParams);
    }

    private void toggleSettingsPanel() {
        if (mSettingsPanel == null) return;
        boolean isVisible = mSettingsPanel.getVisibility() == View.VISIBLE;
        mSettingsPanel.setVisibility(isVisible ? View.GONE : View.VISIBLE);
    }

    private void updateOverlayOpacity(float opacity) {
        if (mHudRootLayout == null) return;
        mLeftJoystick.setAlpha(opacity);
        mRightJoystick.setAlpha(opacity);
        for (View v : mConsoleButtons.values()) {
            v.setAlpha(opacity);
        }
    }

    /**
     * Toggles visibility of Target Pointer Nodes and connecting lines between Play and Edit mode.
     */
    private void updateModeVisuals(boolean isEditMode) {
        int visibility = isEditMode ? View.VISIBLE : View.GONE;

        if (mLinesCanvas != null) {
            mLinesCanvas.setVisibility(visibility);
            mLinesCanvas.invalidate();
        }
        if (mAimAnchorPointer != null) mAimAnchorPointer.setVisibility(visibility);
        if (mMovementAnchorPointer != null) mMovementAnchorPointer.setVisibility(visibility);

        for (View ptr : mTargetPointers.values()) {
            ptr.setVisibility(visibility);
        }
    }

    // =========================================================================
    // TOUCH SYNTHESIS GESTURE DISPATCH ENGINE (AccessibilityService APIs)
    // =========================================================================

    /**
     * Synthesizes an instantaneous low-latency tap event at specified screen coordinates.
     */
    public void injectFastTapGesture(float x, float y) {
        Path tapPath = new Path();
        tapPath.moveTo(x, y);

        GestureDescription.StrokeDescription stroke =
                new GestureDescription.StrokeDescription(tapPath, 0, 15);

        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);

        dispatchGesture(builder.build(), null, null);
    }

    /**
     * Synthesizes continuous drag gestures using GestureDescription and StrokeDescription with
     * willContinue support to prevent camera jitter and maintain analog stick momentum.
     */
    public void injectContinuousDragGesture(float startX, float startY, float endX, float endY, boolean isLeftStick) {
        Path dragPath = new Path();

        if (isLeftStick) {
            dragPath.moveTo(startX, startY);
            dragPath.lineTo(endX, endY);

            GestureDescription.StrokeDescription stroke;
            if (mLeftStickStroke == null) {
                stroke = new GestureDescription.StrokeDescription(dragPath, 0, 50, true);
            } else {
                stroke = mLeftStickStroke.continueStroke(dragPath, 0, 50, true);
            }
            mLeftStickStroke = stroke;

            GestureDescription.Builder builder = new GestureDescription.Builder();
            builder.addStroke(stroke);
            dispatchGesture(builder.build(), null, null);

        } else {
            // Right Analog Stick (Aim & Camera): smooth swipe from anchor towards sensitivity target
            dragPath.moveTo(startX, startY);
            dragPath.lineTo(endX, endY);

            GestureDescription.StrokeDescription stroke;
            if (mRightStickStroke == null) {
                stroke = new GestureDescription.StrokeDescription(dragPath, 0, 35, true);
            } else {
                stroke = mRightStickStroke.continueStroke(dragPath, 0, 35, true);
            }
            mRightStickStroke = stroke;

            mLastRightTargetX = endX;
            mLastRightTargetY = endY;

            GestureDescription.Builder builder = new GestureDescription.Builder();
            builder.addStroke(stroke);
            dispatchGesture(builder.build(), null, null);
        }
    }
}
