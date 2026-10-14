package com.custom.rogcontrols;

import android.content.Context;
import android.content.SharedPreferences;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.lang.reflect.Type;
import java.util.HashMap;
import java.util.Map;

/**
 * Handles persistent storage of ROG Virtual Console layout, sensitivity multipliers,
 * deadzones, and paired Target Pointer coordinates.
 */
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
        public float rightStickSensY = 3.0f; // High vertical boost for recoil & drag-headshots
        public float deadzoneRatio = 0.10f; // 10% deadzone
        public float overlayOpacity = 0.80f; // 80% opacity
        public float buttonScale = 1.0f;
        public boolean isEditMode = false;

        // Joystick positions (screen coordinates)
        public NodePoint leftStickPos = new NodePoint(180, 750);
        public NodePoint leftStickAnchor = new NodePoint(320, 750); // In-game movement D-pad anchor

        public NodePoint rightStickPos = new NodePoint(1850, 720);
        public NodePoint rightStickAnchor = new NodePoint(1550, 480); // In-game camera look anchor

        // Console action buttons and their corresponding target touch nodes
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

        // Standard ROG Handheld Layout (based on 2400x1080 standard landscape)
        // Action Cluster right: A, B, X, Y
        mConfig.buttonPositions.put("BTN_A", new NodePoint(2020, 680));
        mConfig.targetPointers.put("BTN_A", new NodePoint(2100, 850)); // Jump / Primary

        mConfig.buttonPositions.put("BTN_B", new NodePoint(2140, 560));
        mConfig.targetPointers.put("BTN_B", new NodePoint(1980, 880)); // Crouch / Slide

        mConfig.buttonPositions.put("BTN_X", new NodePoint(1900, 560));
        mConfig.targetPointers.put("BTN_X", new NodePoint(2050, 500)); // Reload

        mConfig.buttonPositions.put("BTN_Y", new NodePoint(2020, 440));
        mConfig.targetPointers.put("BTN_Y", new NodePoint(1850, 920)); // Switch Weapon

        // Triggers top corners
        mConfig.buttonPositions.put("BTN_L1", new NodePoint(240, 160));
        mConfig.targetPointers.put("BTN_L1", new NodePoint(420, 420)); // Fire / Scope

        mConfig.buttonPositions.put("BTN_R1", new NodePoint(2160, 160));
        mConfig.targetPointers.put("BTN_R1", new NodePoint(1980, 420)); // Aim Down Sight (ADS)

        // D-Pad Left side
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
}
