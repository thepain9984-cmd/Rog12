export interface ProjectFile {
  path: string;
  name: string;
  category: 'java' | 'manifest' | 'gradle' | 'ci-cd' | 'docs';
  description: string;
  code: string;
}

export const ANDROID_PROJECT_FILES: ProjectFile[] = [
  {
    path: 'app/src/main/java/com/custom/rogcontrols/OverlayService.java',
    name: 'OverlayService.java',
    category: 'java',
    description: 'Core AccessibilityService running WindowManager overlay, Edit/Play mode states, and multi-stroke GestureDescription touch synthesis.',
    code: `package com.custom.rogcontrols;

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

        mLinesCanvas = new ConnectingLinesCanvas(this);
        mHudRootLayout.addView(mLinesCanvas, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        buildJoysticks();
        buildButtonsAndPointers();
        buildTopDock();

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

    private void buildJoysticks() {
        ConfigManager.AppConfig config = mConfigManager.getConfig();

        // Left Analog Joystick
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

        // Right Analog Joystick (BlueStacks X/Y Sensitivity Engine)
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

    private void buildButtonsAndPointers() {
        ConfigManager.AppConfig config = mConfigManager.getConfig();

        for (Map.Entry<String, ConfigManager.NodePoint> entry : config.buttonPositions.entrySet()) {
            final String btnKey = entry.getKey();
            final ConfigManager.NodePoint btnPos = entry.getValue();
            final ConfigManager.NodePoint targetPos = config.targetPointers.get(btnKey);

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

    private void attachButtonBehavior(final View view, final ConfigManager.NodePoint btnPos,
                                      final ConfigManager.NodePoint targetPos, final String key) {
        view.setOnTouchListener(new View.OnTouchListener() {
            private float dX, dY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                ConfigManager.AppConfig config = mConfigManager.getConfig();

                if (config.isEditMode) {
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
                            btnPos.x = newX + v.getWidth() / 2f;
                            btnPos.y = newY + v.getHeight() / 2f;
                            mLinesCanvas.invalidate();
                            return true;

                        case MotionEvent.ACTION_UP:
                            mConfigManager.save();
                            return true;
                    }
                } else {
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

        Button btnSettings = new Button(this);
        btnSettings.setText("⚙ SENSITIVITY");
        btnSettings.setTextSize(11f);
        btnSettings.setTextColor(Color.parseColor("#00E5FF"));
        btnSettings.setBackgroundColor(Color.TRANSPARENT);
        btnSettings.setOnClickListener(v -> toggleSettingsPanel());

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

        buildSettingsDialog();
    }

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

        TextView tvTitle = new TextView(this);
        tvTitle.setText("BLUESTACKS X/Y SENSITIVITY ENGINE");
        tvTitle.setTextColor(Color.parseColor("#00E5FF"));
        tvTitle.setTextSize(12f);
        tvTitle.setPadding(0, 0, 0, 16);
        mSettingsPanel.addView(tvTitle);

        final TextView tvSensX = new TextView(this);
        tvSensX.setText(String.format("Right Stick X-Sens: %.1fx", config.rightStickSensX));
        tvSensX.setTextColor(Color.WHITE);
        tvSensX.setTextSize(11f);
        mSettingsPanel.addView(tvSensX);

        SeekBar sbSensX = new SeekBar(this);
        sbSensX.setMax(75);
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

    public void injectFastTapGesture(float x, float y) {
        Path tapPath = new Path();
        tapPath.moveTo(x, y);

        GestureDescription.StrokeDescription stroke =
                new GestureDescription.StrokeDescription(tapPath, 0, 15);

        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);

        dispatchGesture(builder.build(), null, null);
    }

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
}`
  },
  {
    path: 'app/src/main/java/com/custom/rogcontrols/JoystickView.java',
    name: 'JoystickView.java',
    category: 'java',
    description: 'Custom View rendering ASUS ROG RGB sweep gradient ring, polar coordinate deadzone clamping, and BlueStacks X/Y target scaling.',
    code: `package com.custom.rogcontrols;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PointF;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;

public class JoystickView extends View {

    public interface OnJoystickMoveListener {
        void onMoved(float deltaX, float deltaY, float normX, float normY, float targetX, float targetY);
        void onReleased();
    }

    private Paint mOuterRingPaint;
    private Paint mDeadzoneRingPaint;
    private Paint mKnobPaint;
    private Paint mKnobGlowPaint;
    private Paint mCrosshairPaint;

    private float mCenterX = 0f;
    private float mCenterY = 0f;
    private float mBaseRadius = 0f;
    private float mKnobRadius = 0f;

    private final PointF mKnobPos = new PointF();
    private float mDeadzoneRatio = 0.10f;
    private float mSensX = 1.0f;
    private float mSensY = 1.0f;
    private float mAnchorX = 0f;
    private float mAnchorY = 0f;

    private boolean mIsDragging = false;
    private boolean mIsRightStick = false;
    private OnJoystickMoveListener mListener;

    public JoystickView(Context context) {
        super(context);
        init();
    }

    public JoystickView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    public JoystickView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init();
    }

    private void init() {
        mOuterRingPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        mOuterRingPaint.setStyle(Paint.Style.STROKE);
        mOuterRingPaint.setStrokeWidth(5f);

        mDeadzoneRingPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        mDeadzoneRingPaint.setStyle(Paint.Style.STROKE);
        mDeadzoneRingPaint.setColor(Color.argb(80, 255, 255, 255));
        mDeadzoneRingPaint.setStrokeWidth(2f);

        mCrosshairPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        mCrosshairPaint.setStyle(Paint.Style.STROKE);
        mCrosshairPaint.setColor(Color.argb(60, 255, 0, 63));
        mCrosshairPaint.setStrokeWidth(2f);

        mKnobPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        mKnobPaint.setStyle(Paint.Style.FILL);

        mKnobGlowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        mKnobGlowPaint.setStyle(Paint.Style.FILL);
    }

    public void setRightStick(boolean isRightStick) {
        this.mIsRightStick = isRightStick;
        invalidate();
    }

    public void setSensitivity(float sensX, float sensY) {
        this.mSensX = Math.max(0.1f, Math.min(sensX, 10.0f));
        this.mSensY = Math.max(0.1f, Math.min(sensY, 10.0f));
    }

    public void setDeadzoneRatio(float deadzoneRatio) {
        this.mDeadzoneRatio = Math.max(0.0f, Math.min(deadzoneRatio, 0.40f));
        invalidate();
    }

    public void setAimAnchor(float anchorX, float anchorY) {
        this.mAnchorX = anchorX;
        this.mAnchorY = anchorY;
    }

    public void setOnJoystickMoveListener(OnJoystickMoveListener listener) {
        this.mListener = listener;
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        mCenterX = w / 2f;
        mCenterY = h / 2f;
        mBaseRadius = Math.min(w, h) / 2f - 16f;
        mKnobRadius = mBaseRadius * 0.38f;

        mKnobPos.set(mCenterX, mCenterY);

        int[] rgbColors = mIsRightStick
                ? new int[]{Color.parseColor("#FF003F"), Color.parseColor("#9D00FF"), Color.parseColor("#00E5FF"), Color.parseColor("#FF003F")}
                : new int[]{Color.parseColor("#00E5FF"), Color.parseColor("#3B82F6"), Color.parseColor("#10B981"), Color.parseColor("#00E5FF")};

        SweepGradient sweepShader = new SweepGradient(mCenterX, mCenterY, rgbColors, null);
        mOuterRingPaint.setShader(sweepShader);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (mBaseRadius <= 0) return;

        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.argb(140, 15, 18, 26));
        canvas.drawCircle(mCenterX, mCenterY, mBaseRadius, bgPaint);

        canvas.drawCircle(mCenterX, mCenterY, mBaseRadius, mOuterRingPaint);

        canvas.drawLine(mCenterX - mBaseRadius * 0.8f, mCenterY, mCenterX + mBaseRadius * 0.8f, mCenterY, mCrosshairPaint);
        canvas.drawLine(mCenterX, mCenterY - mBaseRadius * 0.8f, mCenterX, mCenterY + mBaseRadius * 0.8f, mCrosshairPaint);

        float deadzoneRadius = mBaseRadius * mDeadzoneRatio;
        if (deadzoneRadius > 2f) {
            canvas.drawCircle(mCenterX, mCenterY, deadzoneRadius, mDeadzoneRingPaint);
        }

        int knobPrimary = mIsRightStick ? Color.parseColor("#FF003F") : Color.parseColor("#00E5FF");
        RadialGradient knobShader = new RadialGradient(
                mKnobPos.x, mKnobPos.y, mKnobRadius,
                new int[]{Color.WHITE, knobPrimary, Color.parseColor("#121620")},
                new float[]{0.0f, 0.6f, 1.0f},
                Shader.TileMode.CLAMP
        );
        mKnobPaint.setShader(knobShader);

        mKnobGlowPaint.setColor(mIsRightStick ? Color.argb(60, 255, 0, 63) : Color.argb(60, 0, 229, 255));
        canvas.drawCircle(mKnobPos.x, mKnobPos.y, mKnobRadius + 6f, mKnobGlowPaint);
        canvas.drawCircle(mKnobPos.x, mKnobPos.y, mKnobRadius, mKnobPaint);
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        int action = event.getActionMasked();

        switch (action) {
            case MotionEvent.ACTION_DOWN:
            case MotionEvent.ACTION_MOVE: {
                mIsDragging = true;
                float touchX = event.getX();
                float touchY = event.getY();

                float deltaX = touchX - mCenterX;
                float deltaY = touchY - mCenterY;

                float distance = (float) Math.hypot(deltaX, deltaY);
                float maxTravel = mBaseRadius - (mKnobRadius * 0.3f);

                if (distance > maxTravel && distance > 0.0001f) {
                    float ratio = maxTravel / distance;
                    mKnobPos.x = mCenterX + (deltaX * ratio);
                    mKnobPos.y = mCenterY + (deltaY * ratio);
                } else {
                    mKnobPos.x = touchX;
                    mKnobPos.y = touchY;
                }

                invalidate();
                processInputMath(deltaX, deltaY, distance, maxTravel);
                return true;
            }

            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL: {
                mIsDragging = false;
                mKnobPos.set(mCenterX, mCenterY);
                invalidate();

                if (mListener != null) {
                    mListener.onReleased();
                }
                return true;
            }
        }
        return super.onTouchEvent(event);
    }

    private void processInputMath(float deltaX, float deltaY, float distance, float maxTravel) {
        if (mListener == null || maxTravel <= 0) return;

        float normalizedDistance = distance / maxTravel;

        if (normalizedDistance <= mDeadzoneRatio) {
            mListener.onMoved(0f, 0f, 0f, 0f, mAnchorX, mAnchorY);
            return;
        }

        float scale = (normalizedDistance - mDeadzoneRatio) / (1.0f - mDeadzoneRatio);
        scale = Math.min(1.0f, Math.max(0.0f, scale));

        float unitX = distance > 0 ? (deltaX / distance) : 0f;
        float unitY = distance > 0 ? (deltaY / distance) : 0f;

        float effectiveDeltaX = unitX * scale * maxTravel;
        float effectiveDeltaY = unitY * scale * maxTravel;

        float normX = effectiveDeltaX / maxTravel;
        float normY = effectiveDeltaY / maxTravel;

        float targetX = mAnchorX + (effectiveDeltaX * mSensX);
        float targetY = mAnchorY + (effectiveDeltaY * mSensY);

        mListener.onMoved(effectiveDeltaX, effectiveDeltaY, normX, normY, targetX, targetY);
    }
}`
  },
  {
    path: 'app/src/main/java/com/custom/rogcontrols/ConfigManager.java',
    name: 'ConfigManager.java',
    category: 'java',
    description: 'Persistent storage for coordinates, Target Pointers, opacity, and X/Y multipliers using SharedPreferences & Gson.',
    code: `package com.custom.rogcontrols;

import android.content.Context;
import android.content.SharedPreferences;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.lang.reflect.Type;
import java.util.HashMap;
import java.util.Map;

public class ConfigManager {

    private static final String PREF_NAME = "rog_virtual_console_prefs";
    private static final String KEY_CONFIG_DATA = "config_data_json";
    private static ConfigManager sInstance;

    private final SharedPreferences mPrefs;
    private final Gson mGson;
    private AppConfig mConfig;

    public static class NodePoint {
        public float x;
        public float y;

        public NodePoint() {}
        public NodePoint(float x, float y) {
            this.x = x;
            this.y = y;
        }
    }

    public static class AppConfig {
        public float rightStickSensX = 2.0f;
        public float rightStickSensY = 3.0f;
        public float deadzoneRatio = 0.10f;
        public float overlayOpacity = 0.80f;
        public float buttonScale = 1.0f;
        public boolean isEditMode = false;

        public NodePoint leftStickPos = new NodePoint(180, 750);
        public NodePoint leftStickAnchor = new NodePoint(320, 750);

        public NodePoint rightStickPos = new NodePoint(1850, 720);
        public NodePoint rightStickAnchor = new NodePoint(1550, 480);

        public Map<String, NodePoint> buttonPositions = new HashMap<>();
        public Map<String, NodePoint> targetPointers = new HashMap<>();
    }

    private ConfigManager(Context context) {
        mPrefs = context.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        mGson = new Gson();
        load();
    }

    public static synchronized ConfigManager getInstance(Context context) {
        if (sInstance == null) {
            sInstance = new ConfigManager(context);
        }
        return sInstance;
    }

    public synchronized AppConfig getConfig() {
        if (mConfig == null) {
            load();
        }
        return mConfig;
    }

    public synchronized void save() {
        if (mConfig == null) return;
        String json = mGson.toJson(mConfig);
        mPrefs.edit().putString(KEY_CONFIG_DATA, json).apply();
    }

    public synchronized void load() {
        String json = mPrefs.getString(KEY_CONFIG_DATA, null);
        if (json != null) {
            try {
                Type type = new TypeToken<AppConfig>() {}.getType();
                mConfig = mGson.fromJson(json, type);
            } catch (Exception e) {
                mConfig = null;
            }
        }

        if (mConfig == null) {
            resetToRogAllyDefaults();
        }
    }

    public synchronized void resetToRogAllyDefaults() {
        mConfig = new AppConfig();
        mConfig.buttonPositions.clear();
        mConfig.targetPointers.clear();

        mConfig.buttonPositions.put("BTN_A", new NodePoint(2020, 680));
        mConfig.targetPointers.put("BTN_A", new NodePoint(2100, 850));

        mConfig.buttonPositions.put("BTN_B", new NodePoint(2140, 560));
        mConfig.targetPointers.put("BTN_B", new NodePoint(1980, 880));

        mConfig.buttonPositions.put("BTN_X", new NodePoint(1900, 560));
        mConfig.targetPointers.put("BTN_X", new NodePoint(2050, 500));

        mConfig.buttonPositions.put("BTN_Y", new NodePoint(2020, 440));
        mConfig.targetPointers.put("BTN_Y", new NodePoint(1850, 920));

        mConfig.buttonPositions.put("BTN_L1", new NodePoint(240, 160));
        mConfig.targetPointers.put("BTN_L1", new NodePoint(420, 420));

        mConfig.buttonPositions.put("BTN_R1", new NodePoint(2160, 160));
        mConfig.targetPointers.put("BTN_R1", new NodePoint(1980, 420));

        mConfig.buttonPositions.put("DPAD_UP", new NodePoint(420, 560));
        mConfig.targetPointers.put("DPAD_UP", new NodePoint(600, 600));

        mConfig.buttonPositions.put("DPAD_DOWN", new NodePoint(420, 760));
        mConfig.targetPointers.put("DPAD_DOWN", new NodePoint(600, 780));

        save();
    }

    public synchronized String exportToJson() {
        return mGson.toJson(mConfig);
    }

    public synchronized boolean importFromJson(String json) {
        try {
            Type type = new TypeToken<AppConfig>() {}.getType();
            AppConfig imported = mGson.fromJson(json, type);
            if (imported != null) {
                mConfig = imported;
                save();
                return true;
            }
        } catch (Exception ignored) {}
        return false;
    }
}`
  },
  {
    path: 'app/src/main/java/com/custom/rogcontrols/MainActivity.java',
    name: 'MainActivity.java',
    category: 'java',
    description: 'Onboarding dashboard with live permission badges, sensitivity sliders, and service launcher.',
    code: `package com.custom.rogcontrols;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.accessibility.AccessibilityManager;
import android.widget.Button;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import java.util.List;

public class MainActivity extends AppCompatActivity {

    private static final int REQUEST_OVERLAY_PERM = 1001;

    private TextView tvEngineBadge;
    private Button btnGrantOverlay;
    private Button btnGrantAccessibility;
    private Button btnToggleOverlay;
    private Button btnResetDefaults;

    private TextView tvSensXValue;
    private TextView tvSensYValue;
    private TextView tvDeadzoneValue;
    private SeekBar sbSensX;
    private SeekBar sbSensY;
    private SeekBar sbDeadzone;

    private ConfigManager mConfigManager;
    private boolean mIsOverlayRunning = false;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        mConfigManager = ConfigManager.getInstance(this);

        initViews();
        setupSensitivityControls();
        setupActionListeners();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshPermissionStates();
    }

    private void initViews() {
        tvEngineBadge = findViewById(R.id.tvEngineBadge);
        btnGrantOverlay = findViewById(R.id.btnGrantOverlay);
        btnGrantAccessibility = findViewById(R.id.btnGrantAccessibility);
        btnToggleOverlay = findViewById(R.id.btnToggleOverlay);
        btnResetDefaults = findViewById(R.id.btnResetDefaults);

        tvSensXValue = findViewById(R.id.tvSensXValue);
        tvSensYValue = findViewById(R.id.tvSensYValue);
        tvDeadzoneValue = findViewById(R.id.tvDeadzoneValue);
        sbSensX = findViewById(R.id.sbSensX);
        sbSensY = findViewById(R.id.sbSensY);
        sbDeadzone = findViewById(R.id.sbDeadzone);
    }

    private void setupSensitivityControls() {
        ConfigManager.AppConfig config = mConfigManager.getConfig();

        tvSensXValue.setText(String.format("%.1fx", config.rightStickSensX));
        sbSensX.setMax(75);
        sbSensX.setProgress((int) ((config.rightStickSensX - 0.5f) * 10));
        sbSensX.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                float val = 0.5f + (progress / 10f);
                config.rightStickSensX = val;
                tvSensXValue.setText(String.format("%.1fx", val));
                mConfigManager.save();
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });

        tvSensYValue.setText(String.format("%.1fx", config.rightStickSensY));
        sbSensY.setMax(75);
        sbSensY.setProgress((int) ((config.rightStickSensY - 0.5f) * 10));
        sbSensY.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                float val = 0.5f + (progress / 10f);
                config.rightStickSensY = val;
                tvSensYValue.setText(String.format("%.1fx", val));
                mConfigManager.save();
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });

        tvDeadzoneValue.setText(String.format("%d%%", (int) (config.deadzoneRatio * 100)));
        sbDeadzone.setMax(30);
        sbDeadzone.setProgress((int) (config.deadzoneRatio * 100));
        sbDeadzone.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                config.deadzoneRatio = progress / 100f;
                tvDeadzoneValue.setText(String.format("%d%%", progress));
                mConfigManager.save();
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
    }

    private void setupActionListeners() {
        btnGrantOverlay.setOnClickListener(v -> requestOverlayPermission());
        btnGrantAccessibility.setOnClickListener(v -> openAccessibilitySettings());

        btnToggleOverlay.setOnClickListener(v -> {
            if (!hasOverlayPermission()) {
                requestOverlayPermission();
                return;
            }
            if (!isAccessibilityServiceEnabled()) {
                openAccessibilitySettings();
                return;
            }

            Intent serviceIntent = new Intent(this, OverlayService.class);
            if (!mIsOverlayRunning) {
                serviceIntent.setAction(OverlayService.ACTION_START_OVERLAY);
                startService(serviceIntent);
                mIsOverlayRunning = true;
                btnToggleOverlay.setText("DISMISS ROG OVERLAY HUD");
                btnToggleOverlay.setBackgroundColor(Color.parseColor("#374151"));
                Toast.makeText(this, "ROG Overlay active. Open game to play!", Toast.LENGTH_SHORT).show();
            } else {
                serviceIntent.setAction(OverlayService.ACTION_STOP_OVERLAY);
                startService(serviceIntent);
                mIsOverlayRunning = false;
                btnToggleOverlay.setText("ACTIVATE ROG OVERLAY HUD");
                btnToggleOverlay.setBackgroundColor(Color.parseColor("#FF003F"));
            }
        });

        btnResetDefaults.setOnClickListener(v -> {
            mConfigManager.resetToRogAllyDefaults();
            setupSensitivityControls();
            Toast.makeText(this, "Reset to ASUS ROG Ally factory layout!", Toast.LENGTH_SHORT).show();
        });
    }

    private boolean hasOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(this);
        }
        return true;
    }

    private void requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName())
            );
            startActivityForResult(intent, REQUEST_OVERLAY_PERM);
        } else {
            Toast.makeText(this, "Overlay permission already granted!", Toast.LENGTH_SHORT).show();
        }
    }

    private boolean isAccessibilityServiceEnabled() {
        AccessibilityManager am = (AccessibilityManager) getSystemService(Context.ACCESSIBILITY_SERVICE);
        if (am == null) return false;

        List<AccessibilityServiceInfo> enabledServices =
                am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_GENERIC);

        for (AccessibilityServiceInfo service : enabledServices) {
            if (service.getId().contains(getPackageName())) {
                return true;
            }
        }
        return false;
    }

    private void openAccessibilitySettings() {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        Toast.makeText(this, "Find 'ROG Virtual Console' and switch ON", Toast.LENGTH_LONG).show();
    }

    private void refreshPermissionStates() {
        boolean overlayOk = hasOverlayPermission();
        boolean accessOk = isAccessibilityServiceEnabled();

        btnGrantOverlay.setText(overlayOk ? "✓ GRANTED" : "GRANT");
        btnGrantOverlay.setEnabled(!overlayOk);

        btnGrantAccessibility.setText(accessOk ? "✓ ACTIVE" : "ENABLE");
        btnGrantAccessibility.setEnabled(!accessOk);

        if (overlayOk && accessOk) {
            tvEngineBadge.setText("SYSTEM READY");
            tvEngineBadge.setTextColor(Color.parseColor("#10B981"));
        } else {
            tvEngineBadge.setText("SETUP REQUIRED");
            tvEngineBadge.setTextColor(Color.parseColor("#FF003F"));
        }
    }
}`
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    category: 'manifest',
    description: 'System permissions, BIND_ACCESSIBILITY_SERVICE, and specialUse foreground service attributes.',
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.custom.rogcontrols">

    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.ROGVirtualConsole">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="unspecified"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".OverlayService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true"
            android:foregroundServiceType="specialUse">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Virtual gaming gamepad overlay and accessibility touch dispatch engine" />
        </service>

    </application>

</manifest>`
  },
  {
    path: 'app/src/main/res/xml/accessibility_service_config.xml',
    name: 'accessibility_service_config.xml',
    category: 'manifest',
    description: 'Accessibility metadata enabling canPerformGestures="true" for touch injection.',
    code: `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/accessibility_service_desc"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="50"
    android:accessibilityFlags="flagDefault|flagIncludeNotImportantViews|flagReportViewIds"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="false" />`
  },
  {
    path: '.github/workflows/build.yml',
    name: 'build.yml',
    category: 'ci-cd',
    description: 'GitHub Actions automated CI/CD pipeline compiling debug APK on Ubuntu with Temurin JDK 17.',
    code: `name: Build ROG Virtual Console APK

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    name: Assemble Debug APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up JDK 17 (Eclipse Temurin)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
          cache: 'gradle'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v3
        with:
          gradle-version: '8.2'

      - name: Make Gradle Wrapper Executable
        run: |
          if [ -f gradlew ]; then
            chmod +x gradlew
          fi

      - name: Build Debug APK
        run: |
          if [ -f gradlew ]; then
            ./gradlew assembleDebug --stacktrace --no-daemon
          else
            gradle assembleDebug --stacktrace --no-daemon
          fi

      - name: Verify APK Generated
        run: |
          echo "Scanning build outputs..."
          ls -la app/build/outputs/apk/debug/

      - name: Upload Debug APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: rog-virtual-console-debug-apk
          path: app/build/outputs/apk/debug/*.apk
          retention-days: 14`
  },
  {
    path: 'app/build.gradle',
    name: 'app/build.gradle',
    category: 'gradle',
    description: 'App module configuration targeting SDK 34, Java 17 compatibility, and Gson.',
    code: `plugins {
    id("com.android.application")
}

android {
    namespace = "com.custom.rogcontrols"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.custom.rogcontrols"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            applicationIdSuffix = ".debug"
            debuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.cardview:cardview:1.0.0")
    implementation("com.google.code.gson:gson:2.10.1")
}`
  },
  {
    path: 'build.gradle',
    name: 'build.gradle (root)',
    category: 'gradle',
    description: 'Root Gradle configuration defining AGP 8.1.4 and Kotlin plugins.',
    code: `plugins {
    id("com.android.application") version "8.1.4" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}

tasks.register("clean", Delete) {
    delete(rootProject.buildDir)
}`
  },
  {
    path: 'settings.gradle',
    name: 'settings.gradle',
    category: 'gradle',
    description: 'Repository declarations and root project naming.',
    code: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ROG Virtual Console Overlay"
include(":app")`
  }
];
