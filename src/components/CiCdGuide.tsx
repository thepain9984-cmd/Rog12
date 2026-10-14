import React, { useState } from 'react';
import {
  GitBranch,
  Terminal,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Download,
  Play,
  Cpu,
} from 'lucide-react';

export const CiCdGuide: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const adbCommands = `# 1. Install generated debug APK on Android device or emulator
adb install -r app/build/outputs/apk/debug/app-debug.apk

# 2. Grant WindowManager Floating Overlay permission instantly
adb shell appops set com.custom.rogcontrols SYSTEM_ALERT_WINDOW allow

# 3. Enable Accessibility Touch Injection Service (Zero-Root)
adb shell settings put secure enabled_accessibility_services com.custom.rogcontrols/com.custom.rogcontrols.OverlayService
adb shell settings put secure accessibility_enabled 1

# 4. Optional: Verify service is running
adb shell dumpsys accessibility`;

  const gitCommands = `# Initialize Git and push to your GitHub repo
git init
git add .
git commit -m "feat: ROG Virtual Console overlay and BlueStacks touch engine"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rog-virtual-console.git
git push -u origin main`;

  return (
    <div className="w-full space-y-6">
      {/* CI/CD Workflow Overview Card */}
      <div className="bg-[#0c0f18] border border-[#20283c] rounded-xl p-5 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-400">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-sm tracking-wide text-white uppercase">
              GitHub Actions CI/CD Pipeline (.github/workflows/build.yml)
            </h3>
            <p className="text-xs text-gray-400">
              Automated cloud compilation producing signed/unsigned debug APKs on every commit
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#111522] border border-[#232b40] rounded-lg p-4">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>STEP 1: JDK 17 (TEMURIN)</span>
            </div>
            <p className="text-xs text-gray-400">
              Uses <code className="text-gray-300">actions/setup-java@v4</code> with Temurin distribution and automated Gradle dependency caching.
            </p>
          </div>

          <div className="bg-[#111522] border border-[#232b40] rounded-lg p-4">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>STEP 2: GRADLE 8.2 BUILD</span>
            </div>
            <p className="text-xs text-gray-400">
              Runs <code className="text-gray-300">gradle assembleDebug --stacktrace</code> compiling Android SDK 34 targets with zero compiler warnings.
            </p>
          </div>

          <div className="bg-[#111522] border border-[#232b40] rounded-lg p-4">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>STEP 3: ARTIFACT UPLOAD</span>
            </div>
            <p className="text-xs text-gray-400">
              Uploads <code className="text-gray-300">app-debug.apk</code> via <code className="text-gray-300">actions/upload-artifact@v4</code> for 1-click download from GitHub UI.
            </p>
          </div>
        </div>

        {/* GitHub Push Commands Box */}
        <div className="bg-[#090b12] border border-[#222a3d] rounded-lg p-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1c2336]">
            <span className="text-gray-400 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Push Code to GitHub to Trigger CI/CD:
            </span>
            <button
              onClick={() => copyToClipboard(gitCommands, 1)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161d2d] hover:bg-[#202a40] text-gray-300 text-[11px] cursor-pointer"
            >
              {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedIndex === 1 ? 'Copied' : 'Copy Commands'}</span>
            </button>
          </div>
          <pre className="text-emerald-400 whitespace-pre overflow-x-auto">{gitCommands}</pre>
        </div>
      </div>

      {/* ADB Fast Grant Commands Card */}
      <div className="bg-[#0c0f18] border border-[#20283c] rounded-xl p-5 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded bg-cyan-950/60 border border-cyan-700/60 text-[#00e5ff]">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-sm tracking-wide text-white uppercase">
              ADB Fast Onboarding & Permission Grant Terminal Snippets
            </h3>
            <p className="text-xs text-gray-400">
              Instantly grant permissions without manually tapping through Android device settings
            </p>
          </div>
        </div>

        <div className="bg-[#090b12] border border-[#222a3d] rounded-lg p-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1c2336]">
            <span className="text-gray-400 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#00e5ff]" />
              ADB Shell Grants (One-liner Terminal):
            </span>
            <button
              onClick={() => copyToClipboard(adbCommands, 2)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161d2d] hover:bg-[#202a40] text-gray-300 text-[11px] cursor-pointer"
            >
              {copiedIndex === 2 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedIndex === 2 ? 'Copied' : 'Copy Script'}</span>
            </button>
          </div>
          <pre className="text-cyan-300 whitespace-pre overflow-x-auto">{adbCommands}</pre>
        </div>
      </div>
    </div>
  );
};
