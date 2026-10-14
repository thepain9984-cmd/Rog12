package com.custom.rogcontrols;

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

/**
 * ROG Virtual Console Onboarding & Systems Dashboard:
 * - Checks and requests SYSTEM_ALERT_WINDOW (Overlay) permission
 * - Checks and navigates to Accessibility Service settings
 * - Live status indicators for touch synthesis driver
 * - Sensitivity slider configuration synced with ConfigManager
 * - Service lifecycle controller
 */
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

        // X Sensitivity: 0.5x to 8.0x
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

        // Y Sensitivity (Drag Boost): 0.5x to 8.0x
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

        // Deadzone: 0% to 30%
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

        String expectedServiceName = getPackageName() + "/" + OverlayService.class.getName();
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

        if (overlayOk) {
            btnGrantOverlay.setText("✓ GRANTED");
            btnGrantOverlay.setTextColor(Color.parseColor("#10B981"));
            btnGrantOverlay.setEnabled(false);
        } else {
            btnGrantOverlay.setText("GRANT");
            btnGrantOverlay.setTextColor(Color.parseColor("#00E5FF"));
            btnGrantOverlay.setEnabled(true);
        }

        if (accessOk) {
            btnGrantAccessibility.setText("✓ ACTIVE");
            btnGrantAccessibility.setTextColor(Color.parseColor("#10B981"));
            btnGrantAccessibility.setEnabled(false);
        } else {
            btnGrantAccessibility.setText("ENABLE");
            btnGrantAccessibility.setTextColor(Color.parseColor("#FF003F"));
            btnGrantAccessibility.setEnabled(true);
        }

        if (overlayOk && accessOk) {
            tvEngineBadge.setText("SYSTEM READY");
            tvEngineBadge.setTextColor(Color.parseColor("#10B981"));
        } else {
            tvEngineBadge.setText("SETUP REQUIRED");
            tvEngineBadge.setTextColor(Color.parseColor("#FF003F"));
        }
    }
}
