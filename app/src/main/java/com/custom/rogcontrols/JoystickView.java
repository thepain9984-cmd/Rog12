package com.custom.rogcontrols;

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

/**
 * Custom Analog Joystick View designed with ASUS ROG aesthetic.
 * Computes polar coordinate radial displacement, deadzone clamping, and
 * BlueStacks-style X/Y sensitivity multiplied targets.
 */
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
    private float mDeadzoneRatio = 0.10f; // 10% deadzone
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

        // ASUS ROG Cyberpunk RGB Sweep Gradient
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

        // 1. Semi-translucent dark background circle
        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.argb(140, 15, 18, 26));
        canvas.drawCircle(mCenterX, mCenterY, mBaseRadius, bgPaint);

        // 2. Outer RGB Neon Ring
        canvas.drawCircle(mCenterX, mCenterY, mBaseRadius, mOuterRingPaint);

        // 3. Subtle Crosshair lines
        canvas.drawLine(mCenterX - mBaseRadius * 0.8f, mCenterY, mCenterX + mBaseRadius * 0.8f, mCenterY, mCrosshairPaint);
        canvas.drawLine(mCenterX, mCenterY - mBaseRadius * 0.8f, mCenterX, mCenterY + mBaseRadius * 0.8f, mCrosshairPaint);

        // 4. Deadzone visual boundary
        float deadzoneRadius = mBaseRadius * mDeadzoneRatio;
        if (deadzoneRadius > 2f) {
            canvas.drawCircle(mCenterX, mCenterY, deadzoneRadius, mDeadzoneRingPaint);
        }

        // 5. Knob rendering with radial glow
        int knobPrimary = mIsRightStick ? Color.parseColor("#FF003F") : Color.parseColor("#00E5FF");
        RadialGradient knobShader = new RadialGradient(
                mKnobPos.x, mKnobPos.y, mKnobRadius,
                new int[]{Color.WHITE, knobPrimary, Color.parseColor("#121620")},
                new float[]{0.0f, 0.6f, 1.0f},
                Shader.TileMode.CLAMP
        );
        mKnobPaint.setShader(knobShader);

        // Glow ring around knob
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

                // Delta from center
                float deltaX = touchX - mCenterX;
                float deltaY = touchY - mCenterY;

                // Polar coordinate distance D
                float distance = (float) Math.hypot(deltaX, deltaY);
                float maxTravel = mBaseRadius - (mKnobRadius * 0.3f);

                // Clamp knob position within maximum radius
                if (distance > maxTravel && distance > 0.0001f) {
                    float ratio = maxTravel / distance;
                    mKnobPos.x = mCenterX + (deltaX * ratio);
                    mKnobPos.y = mCenterY + (deltaY * ratio);
                } else {
                    mKnobPos.x = touchX;
                    mKnobPos.y = touchY;
                }

                invalidate();

                // Compute deadzone & sensitivity output
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

    /**
     * Executes the BlueStacks X/Y Sensitivity Engine mathematics:
     * - Deadzone cutoff and normalization
     * - Independent X-Axis (Sx) and Y-Axis (Sy) scaling
     * - Target point projection relative to Aim Anchor
     */
    private void processInputMath(float deltaX, float deltaY, float distance, float maxTravel) {
        if (mListener == null || maxTravel <= 0) return;

        float normalizedDistance = distance / maxTravel;

        if (normalizedDistance <= mDeadzoneRatio) {
            // Within deadzone threshold -> Zero output to eliminate analog stick drift
            mListener.onMoved(0f, 0f, 0f, 0f, mAnchorX, mAnchorY);
            return;
        }

        // Rescale normalized deflection past the deadzone [0.0 .. 1.0]
        float scale = (normalizedDistance - mDeadzoneRatio) / (1.0f - mDeadzoneRatio);
        scale = Math.min(1.0f, Math.max(0.0f, scale));

        float unitX = distance > 0 ? (deltaX / distance) : 0f;
        float unitY = distance > 0 ? (deltaY / distance) : 0f;

        float effectiveDeltaX = unitX * scale * maxTravel;
        float effectiveDeltaY = unitY * scale * maxTravel;

        float normX = effectiveDeltaX / maxTravel;
        float normY = effectiveDeltaY / maxTravel;

        // Apply independent BlueStacks X/Y sensitivity multipliers:
        // Target_x = Anchor_x + (Delta_x * S_x)
        // Target_y = Anchor_y + (Delta_y * S_y)
        float targetX = mAnchorX + (effectiveDeltaX * mSensX);
        float targetY = mAnchorY + (effectiveDeltaY * mSensY);

        mListener.onMoved(effectiveDeltaX, effectiveDeltaY, normX, normY, targetX, targetY);
    }
}
