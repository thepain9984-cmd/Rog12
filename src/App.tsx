/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Gamepad2,
  Code2,
  Cpu,
  GitBranch,
  Download,
  Share2,
  FileJson,
  Upload,
  RotateCcw,
  ShieldCheck,
  Zap,
  Info,
} from 'lucide-react';
import { VirtualConsoleCanvas, SensitivityConfig } from './components/VirtualConsoleCanvas';
import { CodeInspector } from './components/CodeInspector';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { CiCdGuide } from './components/CiCdGuide';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'architecture' | 'cicd'>('simulator');

  // Sensitivity Configuration
  const [sensConfig, setSensConfig] = useState<SensitivityConfig>({
    sensX: 2.0,
    sensY: 3.2,
    deadzone: 0.10,
    opacity: 0.85,
    buttonScale: 1.0,
  });

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<string>('Free Fire Drag');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [configJsonText, setConfigJsonText] = useState<string>('');

  // Preset switch handler
  const handleSelectPreset = (presetName: string) => {
    setActivePreset(presetName);
    switch (presetName) {
      case 'Free Fire Drag':
        setSensConfig((prev) => ({ ...prev, sensX: 1.6, sensY: 3.8, deadzone: 0.08 }));
        break;
      case 'PUBG / CODM':
        setSensConfig((prev) => ({ ...prev, sensX: 2.0, sensY: 2.4, deadzone: 0.12 }));
        break;
      case 'Genshin Impact':
        setSensConfig((prev) => ({ ...prev, sensX: 1.8, sensY: 1.5, deadzone: 0.10 }));
        break;
      default:
        break;
    }
  };

  const handleResetLayout = () => {
    setSensConfig({
      sensX: 2.0,
      sensY: 3.0,
      deadzone: 0.10,
      opacity: 0.80,
      buttonScale: 1.0,
    });
    setActivePreset('ROG Ally Default');
  };

  const handleOpenExportModal = () => {
    const exportedData = {
      rightStickSensX: sensConfig.sensX,
      rightStickSensY: sensConfig.sensY,
      deadzoneRatio: sensConfig.deadzone,
      overlayOpacity: sensConfig.opacity,
      buttonScale: sensConfig.buttonScale,
      isEditMode: false,
      leftStickPos: { x: 180, y: 750 },
      leftStickAnchor: { x: 320, y: 750 },
      rightStickPos: { x: 1850, y: 720 },
      rightStickAnchor: { x: 1550, y: 480 },
      buttonPositions: {
        BTN_A: { x: 2020, y: 680 },
        BTN_B: { x: 2140, y: 560 },
        BTN_X: { x: 1900, y: 560 },
        BTN_Y: { x: 2020, y: 440 },
        BTN_L1: { x: 240, y: 160 },
        BTN_R1: { x: 2160, y: 160 },
      },
      targetPointers: {
        BTN_A: { x: 2100, y: 850 },
        BTN_B: { x: 1980, y: 880 },
        BTN_X: { x: 2050, y: 500 },
        BTN_Y: { x: 1850, y: 920 },
        BTN_L1: { x: 420, y: 420 },
        BTN_R1: { x: 1980, y: 420 },
      },
    };
    setConfigJsonText(JSON.stringify(exportedData, null, 2));
    setShowConfigModal(true);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(configJsonText);
      if (parsed.rightStickSensX && parsed.rightStickSensY) {
        setSensConfig((prev) => ({
          ...prev,
          sensX: parsed.rightStickSensX,
          sensY: parsed.rightStickSensY,
          deadzone: parsed.deadzoneRatio || prev.deadzone,
          opacity: parsed.overlayOpacity || prev.opacity,
        }));
        setShowConfigModal(false);
      }
    } catch (e) {
      alert('Invalid JSON structure. Please check the ConfigManager syntax.');
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-[#f1f5f9] flex flex-col font-sans">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#090c14]/95 border-b border-[#1b2234] backdrop-blur-md px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff003f] via-[#9d00ff] to-[#00e5ff] p-[2px] shadow-lg shadow-red-900/30">
              <div className="w-full h-full bg-[#0a0d16] rounded-md flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-[#ff003f]" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-orbitron font-black text-lg tracking-wider text-white">
                  ROG VIRTUAL CONSOLE
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#ff003f]/20 border border-[#ff003f]/50 text-[#ff003f]">
                  SDK 34 READY
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono">
                ASUS ROG Ally Touch Keymapper & BlueStacks X/Y Sensitivity Engine
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-[#101422] p-1 rounded-lg border border-[#20273c]">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-[#ff003f] text-white shadow-md shadow-red-900/40 font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span>LIVE SIMULATOR</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'code'
                  ? 'bg-[#ff003f] text-white shadow-md shadow-red-900/40 font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>ANDROID CODEBASE (10 FILES)</span>
            </button>

            <button
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'architecture'
                  ? 'bg-[#ff003f] text-white shadow-md shadow-red-900/40 font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>ARCHITECTURE & MATH</span>
            </button>

            <button
              onClick={() => setActiveTab('cicd')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'cicd'
                  ? 'bg-[#ff003f] text-white shadow-md shadow-red-900/40 font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>CI/CD & ADB GUIDE</span>
            </button>
          </nav>

          {/* Top Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenExportModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141926] hover:bg-[#1c2336] border border-[#263148] text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span>Config JSON</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Tab 1: Live Gamepad Simulator */}
        {activeTab === 'simulator' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d101a] p-3 rounded-lg border border-[#1e2538] text-xs">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-400">
                  <Zap className="w-4 h-4" />
                </span>
                <span className="text-gray-300">
                  <strong className="text-white">BlueStacks X/Y Engine Active:</strong> Move the Right Stick to test sensitivity scaling (Sx={sensConfig.sensX}x, Sy={sensConfig.sensY}x). Click any button to test synthetic touch injection.
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 font-mono text-[11px]">
                <span>Zero Root Required</span>
                <span>•</span>
                <span>Multi-touch GestureDescription</span>
              </div>
            </div>

            <VirtualConsoleCanvas
              sensConfig={sensConfig}
              onUpdateSensConfig={setSensConfig}
              isEditMode={isEditMode}
              onToggleEditMode={() => setIsEditMode(!isEditMode)}
              onResetLayout={handleResetLayout}
              activePresetName={activePreset}
              onSelectPreset={handleSelectPreset}
            />
          </div>
        )}

        {/* Tab 2: Android Project Deliverables & Code Inspector */}
        {activeTab === 'code' && (
          <div className="space-y-4">
            <CodeInspector />
          </div>
        )}

        {/* Tab 3: System Architecture & BlueStacks Math Engine */}
        {activeTab === 'architecture' && (
          <div className="space-y-4">
            <ArchitectureDiagram />
          </div>
        )}

        {/* Tab 4: GitHub Actions CI/CD & ADB Guide */}
        {activeTab === 'cicd' && (
          <div className="space-y-4">
            <CiCdGuide />
          </div>
        )}
      </main>

      {/* JSON Import/Export Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e121d] border border-[#2b354e] rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#21293d]">
              <div className="flex items-center gap-2 text-white font-orbitron font-bold text-sm">
                <FileJson className="w-4 h-4 text-[#00e5ff]" />
                <span>ConfigManager JSON Sync Profile</span>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              This JSON payload maps 1:1 with Android <code className="text-cyan-300">ConfigManager.AppConfig</code> serialized via Gson to <code className="text-cyan-300">SharedPreferences</code>.
            </p>

            <textarea
              rows={12}
              value={configJsonText}
              onChange={(e) => setConfigJsonText(e.target.value)}
              className="w-full bg-[#080a11] border border-[#212a3e] rounded-lg p-3 font-mono text-xs text-gray-200 focus:outline-none focus:border-[#ff003f]"
            ></textarea>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded text-xs text-gray-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImportJson}
                className="px-4 py-2 rounded bg-[#ff003f] hover:bg-[#e60039] text-white text-xs font-bold font-orbitron tracking-wide cursor-pointer"
              >
                APPLY CONFIGURATION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Footer */}
      <footer className="border-t border-[#1a2133] py-4 px-6 text-center text-xs text-gray-500 font-mono">
        ROG Virtual Console Overlay (<code className="text-gray-400">com.custom.rogcontrols</code>) • Engineered for Android 8.0–14+ (SDK 26–34)
      </footer>
    </div>
  );
}
