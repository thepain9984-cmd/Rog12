# ROG Virtual Console Overlay (`com.custom.rogcontrols`)
> Low-Latency Floating Virtual Handheld Gamepad & Touch Keymapper Overlay inspired by the ASUS ROG Ally console layout and BlueStacks Keymapper mechanics.

---

## 🎮 Features Overview

1. **BlueStacks-Style X/Y Sensitivity Engine (Right Analog Stick):**
   - Independent horizontal ($S_x$) and vertical ($S_y$) sensitivity scaling (0.1x – 10.0x).
   - Radial deadzone filtering (0% – 30%) with polar coordinate clamping:
     $$D = \sqrt{\Delta x^2 + \Delta y^2}, \quad \text{Clamped within } R_{max}$$
   - Sensitivity target translation relative to Aim Anchor:
     $$Target_x = Anchor_x + (\Delta x \times S_x)$$
     $$Target_y = Anchor_y + (\Delta y \times S_y)$$
   - Vertical recoil drag acceleration boost for competitive shooters (Free Fire, PUBG Mobile, Call of Duty: Mobile).

2. **Left Analog Thumbstick (Movement D-Pad):**
   - Dynamic 360-degree continuous analog vector dispatch to in-game movement joystick anchor.
   - Smooth gesture stroke chaining (`StrokeDescription.willContinue`) for seamless sprinting and movement without jitter.

3. **Touch Keymapper & Target Pointer System:**
   - **Play Mode (`isEditMode == false`):** Gamepad buttons (`A`, `B`, `X`, `Y`, `L1`, `R1`, D-Pad) synthesize ultra-fast tap and hold gestures at paired Target Pointer coordinates.
   - **Edit Mode (`isEditMode == true`):** Real-time interactive drag & drop on both Gamepad buttons and Target Pointers with animated connecting vector lines.

4. **Zero-Root Touch Dispatch Engine:**
   - Employs Android `AccessibilityService` APIs (`dispatchGesture`) requiring **zero root access**, zero ADB debugging tethering at runtime, and zero custom ROM modifications.

---

## 📁 Repository Structure

```
├── .github/workflows/
│   └── build.yml               # GitHub Actions CI/CD to build debug APK
├── app/
│   ├── build.gradle            # Android Gradle Plugin 8.1+, SDK 34, Java 17
│   └── src/main/
│       ├── AndroidManifest.xml # SYSTEM_ALERT_WINDOW & BIND_ACCESSIBILITY_SERVICE
│       ├── java/com/custom/rogcontrols/
│       │   ├── MainActivity.java     # Onboarding dashboard & permission checker
│       │   ├── ConfigManager.java    # SharedPreferences JSON persistence
│       │   ├── JoystickView.java     # RGB Neon custom View & polar math
│       │   └── OverlayService.java   # WindowManager overlay & touch injection
│       └── res/
│           ├── layout/activity_main.xml
│           └── xml/accessibility_service_config.xml
├── build.gradle                # Root Gradle configuration
├── settings.gradle             # Project module definitions
└── gradle.properties           # AndroidX & JVM tuning
```

---

## ⚙️ CI/CD & Building

### Automatic GitHub Actions Build
Every push or pull request to `main` triggers `.github/workflows/build.yml`:
1. Sets up JDK 17 (Temurin).
2. Configures Gradle 8.2+.
3. Runs `./gradlew assembleDebug --stacktrace`.
4. Uploads `app-debug.apk` directly to GitHub Action Artifacts.

### Local Command Line Build
```bash
./gradlew assembleDebug
# Generated APK path:
# app/build/outputs/apk/debug/app-debug.apk
```

---

## 🛠️ Instant ADB Permission Grants (Optional Fast Setup)

```bash
# Install Debug APK
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Grant Overlay Permission
adb shell appops set com.custom.rogcontrols SYSTEM_ALERT_WINDOW allow

# Enable Accessibility Service
adb shell settings put secure enabled_accessibility_services com.custom.rogcontrols/com.custom.rogcontrols.OverlayService
adb shell settings put secure accessibility_enabled 1
```
