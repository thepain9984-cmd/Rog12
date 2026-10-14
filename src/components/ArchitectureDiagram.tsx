import React, { useState } from 'react';
import {
  Layers,
  Cpu,
  Compass,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Calculator,
  Eye,
  Sliders,
} from 'lucide-react';

export const ArchitectureDiagram: React.FC = () => {
  // Interactive Math Calculator state
  const [calcDeltaX, setCalcDeltaX] = useState<number>(35);
  const [calcDeltaY, setCalcDeltaY] = useState<number>(-45);
  const [calcSensX, setCalcSensX] = useState<number>(2.0);
  const [calcSensY, setCalcSensY] = useState<number>(3.5);
  const [calcDeadzone, setCalcDeadzone] = useState<number>(0.10);

  const anchorX = 1550;
  const anchorY = 480;
  const maxRadius = 60;

  // Polar math
  const rawDist = Math.hypot(calcDeltaX, calcDeltaY);
  const clampedDist = Math.min(maxRadius, rawDist);
  const normDist = clampedDist / maxRadius;
  const inDeadzone = normDist <= calcDeadzone;

  const scale = inDeadzone ? 0 : (normDist - calcDeadzone) / (1.0 - calcDeadzone);
  const unitX = rawDist > 0 ? calcDeltaX / rawDist : 0;
  const unitY = rawDist > 0 ? calcDeltaY / rawDist : 0;

  const effDeltaX = unitX * scale * maxRadius;
  const effDeltaY = unitY * scale * maxRadius;

  const targetX = anchorX + effDeltaX * calcSensX;
  const targetY = anchorY + effDeltaY * calcSensY;

  return (
    <div className="w-full space-y-6">
      {/* Pipeline Blocks Architecture Flow */}
      <div className="bg-[#0c0f18] border border-[#20283c] rounded-xl p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-[#ff003f]" />
          <h3 className="font-orbitron font-bold text-sm tracking-wide text-white uppercase">
            Android System Architecture & Touch Synthesis Pipeline
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Layer 1: WindowManager */}
          <div className="bg-[#111522] border border-[#232b40] rounded-lg p-4 relative group hover:border-[#ff003f] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-[#ff003f] px-2 py-0.5 rounded bg-red-950/60 border border-red-800">
                LAYER 1
              </span>
              <Eye className="w-4 h-4 text-gray-400 group-hover:text-[#ff003f]" />
            </div>
            <h4 className="font-orbitron text-xs font-bold text-white mb-1">
              Translucent WindowManager
            </h4>
            <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
              Renders overlay using <code className="text-cyan-300">TYPE_APPLICATION_OVERLAY</code> and <code className="text-cyan-300">FLAG_NOT_FOCUSABLE</code>.
            </p>
            <ul className="text-[10px] font-mono text-gray-400 space-y-1">
              <li>• ROG RGB Joystick Canvas</li>
              <li>• Connecting Vector Lines</li>
              <li>• Edit/Play Top Dock Pill</li>
            </ul>
          </div>

          {/* Layer 2: Analog Math Engine */}
          <div className="bg-[#111522] border border-[#232b40] rounded-lg p-4 relative group hover:border-[#00e5ff] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-[#00e5ff] px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800">
                LAYER 2
              </span>
              <Compass className="w-4 h-4 text-gray-400 group-hover:text-[#00e5ff]" />
            </div>
            <h4 className="font-orbitron text-xs font-bold text-white mb-1">
              BlueStacks X/Y Math Engine
            </h4>
            <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
              Extracts polar displacement (Δx, Δy), applies radial deadzone, and multiplies horizontal vs vertical sensitivity.
            </p>
            <ul className="text-[10px] font-mono text-gray-400 space-y-1">
              <li>• D = √(Δx² + Δy²) ≤ R_max</li>
              <li>• Target_x = Anchor_x + (Δx · S_x)</li>
              <li>• Target_y = Anchor_y + (Δy · S_y)</li>
            </ul>
          </div>

          {/* Layer 3: Accessibility Dispatcher */}
          <div className="bg-[#111522] border border-[#232b40] rounded-lg p-4 relative group hover:border-emerald-400 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800">
                LAYER 3
              </span>
              <Zap className="w-4 h-4 text-gray-400 group-hover:text-emerald-400" />
            </div>
            <h4 className="font-orbitron text-xs font-bold text-white mb-1">
              Accessibility Touch Driver
            </h4>
            <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
              Injects touch strokes via <code className="text-emerald-300">dispatchGesture()</code> without requiring root or PC ADB tethering.
            </p>
            <ul className="text-[10px] font-mono text-gray-400 space-y-1">
              <li>• <code className="text-gray-300">canPerformGestures="true"</code></li>
              <li>• <code className="text-gray-300">StrokeDescription.willContinue</code></li>
              <li>• Multi-touch button taps</li>
            </ul>
          </div>

          {/* Layer 4: Mobile Game Surface */}
          <div className="bg-[#111522] border border-[#232b40] rounded-lg p-4 relative group hover:border-purple-400 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800">
                LAYER 4
              </span>
              <Activity className="w-4 h-4 text-gray-400 group-hover:text-purple-400" />
            </div>
            <h4 className="font-orbitron text-xs font-bold text-white mb-1">
              Game Engine SurfaceView
            </h4>
            <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
              Unity, Unreal Engine, or custom Vulkan/OpenGL renderer receives native MotionEvents seamlessly.
            </p>
            <ul className="text-[10px] font-mono text-gray-400 space-y-1">
              <li>• Zero game client ban risk</li>
              <li>• Low input latency (&lt;4ms)</li>
              <li>• Smooth 120 FPS camera drag</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Interactive Mathematics Playground */}
      <div className="bg-[#0c0f18] border border-[#20283c] rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#00e5ff]" />
            <h3 className="font-orbitron font-bold text-sm tracking-wide text-white uppercase">
              Live BlueStacks X/Y Sensitivity Formula Calculator
            </h3>
          </div>
          <span className="text-xs font-mono text-gray-400">
            Anchor: ({anchorX}, {anchorY})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sliders Control */}
          <div className="space-y-4 bg-[#101422] p-4 rounded-lg border border-[#1e263a]">
            <div>
              <div className="flex justify-between text-xs font-mono text-gray-300 mb-1">
                <span>Input Deflection ΔX:</span>
                <span className="text-[#00e5ff] font-bold">{calcDeltaX} px</span>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                value={calcDeltaX}
                onChange={(e) => setCalcDeltaX(parseInt(e.target.value))}
                className="w-full accent-[#00e5ff] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-gray-300 mb-1">
                <span>Input Deflection ΔY (Vertical):</span>
                <span className="text-[#ff003f] font-bold">{calcDeltaY} px</span>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                value={calcDeltaY}
                onChange={(e) => setCalcDeltaY(parseInt(e.target.value))}
                className="w-full accent-[#ff003f] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-gray-300 mb-1">
                <span>X Sensitivity Multiplier (Sx):</span>
                <span className="text-[#00e5ff] font-bold">{calcSensX.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.1"
                value={calcSensX}
                onChange={(e) => setCalcSensX(parseFloat(e.target.value))}
                className="w-full accent-[#00e5ff] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-gray-300 mb-1">
                <span>Y Sensitivity Multiplier (Sy - Drag Boost):</span>
                <span className="text-[#ff003f] font-bold">{calcSensY.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.1"
                value={calcSensY}
                onChange={(e) => setCalcSensY(parseFloat(e.target.value))}
                className="w-full accent-[#ff003f] cursor-pointer"
              />
            </div>
          </div>

          {/* Mathematical Computation Outputs */}
          <div className="flex flex-col justify-between bg-[#101422] p-4 rounded-lg border border-[#1e263a] font-mono text-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#20283c]">
                <span className="text-gray-400">Radial Magnitude (D = √(Δx² + Δy²)):</span>
                <span className="text-white font-bold">{rawDist.toFixed(1)} px (Clamped: {clampedDist.toFixed(1)} px)</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#20283c]">
                <span className="text-gray-400">Deadzone Filter (&lt; 10% cutoff):</span>
                <span className={`font-bold ${inDeadzone ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {inDeadzone ? 'DRIFT SUPPRESSED (0)' : 'ACTIVE SIGNAL'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#20283c]">
                <span className="text-gray-400">Scaled Δx with Sx ({calcSensX}x):</span>
                <span className="text-[#00e5ff] font-bold">{(effDeltaX * calcSensX).toFixed(1)} px</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#20283c]">
                <span className="text-gray-400">Scaled Δy with Sy ({calcSensY}x):</span>
                <span className="text-[#ff003f] font-bold">{(effDeltaY * calcSensY).toFixed(1)} px</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded bg-[#171d2e] border border-[#26334f]">
              <span className="text-[10px] text-gray-400 block mb-1">
                FINAL SYNTHESIZED SCREEN TOUCH COORDINATES (TARGET_X, TARGET_Y):
              </span>
              <div className="text-lg font-bold text-white flex items-center justify-between">
                <span className="text-cyan-400">X: {Math.round(targetX)} px</span>
                <span className="text-rose-400">Y: {Math.round(targetY)} px</span>
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 block">
                ✓ Ready for <code className="text-white font-mono">GestureDescription.Builder().addStroke()</code>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
