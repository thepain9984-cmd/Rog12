import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Lock,
  Unlock,
  Sliders,
  RotateCcw,
  Crosshair,
  Zap,
  Layers,
  Sparkles,
  Maximize2
} from 'lucide-react';

export interface ConsoleButtonConfig {
  id: string;
  label: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  targetX: number; // percentage 0 - 100
  targetY: number; // percentage 0 - 100
  color: string;
  size: number;
}

export interface SensitivityConfig {
  sensX: number;
  sensY: number;
  deadzone: number; // 0 to 0.3
  opacity: number; // 0.1 to 1.0
  buttonScale: number;
}

interface GestureEventLog {
  id: string;
  time: string;
  source: string;
  coords: { x: number; y: number };
  target: { x: number; y: number };
  durationMs: number;
  type: 'TAP' | 'DRAG_CONTINUE' | 'AIM_SWIPE';
}

interface VirtualConsoleCanvasProps {
  sensConfig: SensitivityConfig;
  onUpdateSensConfig: (config: SensitivityConfig) => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onResetLayout: () => void;
  activePresetName: string;
  onSelectPreset: (presetName: string) => void;
}

const DEFAULT_BUTTONS: ConsoleButtonConfig[] = [
  { id: 'BTN_A', label: 'A', x: 86, y: 70, targetX: 90, targetY: 82, color: '#FF003F', size: 54 },
  { id: 'BTN_B', label: 'B', x: 92, y: 58, targetX: 83, targetY: 85, color: '#FF003F', size: 54 },
  { id: 'BTN_X', label: 'X', x: 80, y: 58, targetX: 88, targetY: 48, color: '#FF003F', size: 54 },
  { id: 'BTN_Y', label: 'Y', x: 86, y: 46, targetX: 78, targetY: 89, color: '#FF003F', size: 54 },
  { id: 'BTN_L1', label: 'L1', x: 12, y: 16, targetX: 20, targetY: 42, color: '#00E5FF', size: 58 },
  { id: 'BTN_R1', label: 'R1', x: 88, y: 16, targetX: 82, targetY: 40, color: '#00E5FF', size: 58 },
  { id: 'DPAD_UP', label: '▲', x: 16, y: 52, targetX: 26, targetY: 62, color: '#9D00FF', size: 48 },
  { id: 'DPAD_DOWN', label: '▼', x: 16, y: 72, targetX: 26, targetY: 78, color: '#9D00FF', size: 48 },
];

export const VirtualConsoleCanvas: React.FC<VirtualConsoleCanvasProps> = ({
  sensConfig,
  onUpdateSensConfig,
  isEditMode,
  onToggleEditMode,
  onResetLayout,
  activePresetName,
  onSelectPreset,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Buttons state
  const [buttons, setButtons] = useState<ConsoleButtonConfig[]>(DEFAULT_BUTTONS);

  // Joysticks positions (percentages)
  const [leftStickPos, setLeftStickPos] = useState({ x: 14, y: 76 });
  const [leftStickAnchor, setLeftStickAnchor] = useState({ x: 22, y: 76 });

  const [rightStickPos, setRightStickPos] = useState({ x: 74, y: 76 });
  const [rightStickAnchor, setRightStickAnchor] = useState({ x: 65, y: 46 });

  // Joystick dynamic knob deflections (pixels from joystick center)
  const [leftKnobOffset, setLeftKnobOffset] = useState({ x: 0, y: 0 });
  const [rightKnobOffset, setRightKnobOffset] = useState({ x: 0, y: 0 });
  const [isRightStickActive, setIsRightStickActive] = useState(false);
  const [isLeftStickActive, setIsLeftStickActive] = useState(false);

  // Active touch injection visual ripple effects
  const [touchRipples, setTouchRipples] = useState<Array<{ id: number; x: number; y: number; label: string; color: string }>>([]);

  // Telemetry state
  const [telemetry, setTelemetry] = useState<{
    deltaX: number;
    deltaY: number;
    distance: number;
    normalizedDist: number;
    effectiveDeltaX: number;
    effectiveDeltaY: number;
    projectedTargetX: number;
    projectedTargetY: number;
    inDeadzone: boolean;
  }>({
    deltaX: 0,
    deltaY: 0,
    distance: 0,
    normalizedDist: 0,
    effectiveDeltaX: 0,
    effectiveDeltaY: 0,
    projectedTargetX: rightStickAnchor.x,
    projectedTargetY: rightStickAnchor.y,
    inDeadzone: true,
  });

  // Recent Gesture Event Logs (for real-time synthetic feedback)
  const [gestureLogs, setGestureLogs] = useState<GestureEventLog[]>([]);

  // Dragging in Edit Mode state
  const [draggingItem, setDraggingItem] = useState<{
    type: 'button' | 'pointer' | 'leftStick' | 'leftAnchor' | 'rightStick' | 'rightAnchor';
    id?: string;
  } | null>(null);

  // Game Backdrop selector
  const [backdropTheme, setBackdropTheme] = useState<'cyberpunk' | 'arena' | 'grid'>('cyberpunk');
  const [showSensitivityDrawer, setShowSensitivityDrawer] = useState(false);

  const addTouchRipple = useCallback((x: number, y: number, label: string, color: string) => {
    const id = Date.now() + Math.random();
    setTouchRipples((prev) => [...prev.slice(-6), { id, x, y, label, color }]);

    // Add to synthetic logs
    const logItem: GestureEventLog = {
      id: String(id),
      time: new Date().toLocaleTimeString().split(' ')[0],
      source: label,
      coords: { x: Math.round(x), y: Math.round(y) },
      target: { x: Math.round(x), y: Math.round(y) },
      durationMs: 15,
      type: 'TAP',
    };
    setGestureLogs((prev) => [logItem, ...prev.slice(0, 14)]);

    setTimeout(() => {
      setTouchRipples((prev) => prev.filter((r) => r.id !== id));
    }, 700);
  }, []);

  // Handle Button Click in Play Mode
  const handleButtonClick = (btn: ConsoleButtonConfig) => {
    if (isEditMode) return;
    addTouchRipple(btn.targetX, btn.targetY, btn.label, btn.color);
  };

  // Dragging logic for Edit Mode
  const handlePointerDown = (
    e: React.PointerEvent,
    type: 'button' | 'pointer' | 'leftStick' | 'leftAnchor' | 'rightStick' | 'rightAnchor',
    id?: string
  ) => {
    if (!isEditMode) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingItem({ type, id });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamping to container 2% - 98%
    const clampedX = Math.max(2, Math.min(98, currentX));
    const clampedY = Math.max(2, Math.min(98, currentY));

    if (isEditMode && draggingItem) {
      if (draggingItem.type === 'button' && draggingItem.id) {
        setButtons((prev) =>
          prev.map((b) => (b.id === draggingItem.id ? { ...b, x: clampedX, y: clampedY } : b))
        );
      } else if (draggingItem.type === 'pointer' && draggingItem.id) {
        setButtons((prev) =>
          prev.map((b) => (b.id === draggingItem.id ? { ...b, targetX: clampedX, targetY: clampedY } : b))
        );
      } else if (draggingItem.type === 'leftStick') {
        setLeftStickPos({ x: clampedX, y: clampedY });
      } else if (draggingItem.type === 'leftAnchor') {
        setLeftStickAnchor({ x: clampedX, y: clampedY });
      } else if (draggingItem.type === 'rightStick') {
        setRightStickPos({ x: clampedX, y: clampedY });
      } else if (draggingItem.type === 'rightAnchor') {
        setRightStickAnchor({ x: clampedX, y: clampedY });
      }
      return;
    }

    // Right Stick Play Mode Interactive Analog math
    if (!isEditMode && isRightStickActive) {
      processRightStickMath(e.clientX, e.clientY, rect);
    }

    // Left Stick Play Mode Interactive Analog math
    if (!isEditMode && isLeftStickActive) {
      processLeftStickMath(e.clientX, e.clientY, rect);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingItem) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      setDraggingItem(null);
    }

    if (isRightStickActive) {
      setIsRightStickActive(false);
      setRightKnobOffset({ x: 0, y: 0 });
      setTelemetry((prev) => ({
        ...prev,
        deltaX: 0,
        deltaY: 0,
        distance: 0,
        normalizedDist: 0,
        effectiveDeltaX: 0,
        effectiveDeltaY: 0,
        inDeadzone: true,
      }));
    }

    if (isLeftStickActive) {
      setIsLeftStickActive(false);
      setLeftKnobOffset({ x: 0, y: 0 });
    }
  };

  // Right Analog Math Engine (BlueStacks X/Y Sensitivity formula)
  const processRightStickMath = (clientX: number, clientY: number, rect: DOMRect) => {
    const stickCenterPxX = rect.left + (rightStickPos.x / 100) * rect.width;
    const stickCenterPxY = rect.top + (rightStickPos.y / 100) * rect.height;

    const deltaX = clientX - stickCenterPxX;
    const deltaY = clientY - stickCenterPxY;

    const maxRadius = 60; // pixel travel
    const distance = Math.hypot(deltaX, deltaY);

    let clampedKnobX = deltaX;
    let clampedKnobY = deltaY;

    if (distance > maxRadius) {
      clampedKnobX = (deltaX / distance) * maxRadius;
      clampedKnobY = (deltaY / distance) * maxRadius;
    }
    setRightKnobOffset({ x: clampedKnobX, y: clampedKnobY });

    const normalizedDist = Math.min(1.0, distance / maxRadius);
    const inDeadzone = normalizedDist <= sensConfig.deadzone;

    let effectiveDeltaX = 0;
    let effectiveDeltaY = 0;
    let projTargetX = rightStickAnchor.x;
    let projTargetY = rightStickAnchor.y;

    if (!inDeadzone) {
      const scale = (normalizedDist - sensConfig.deadzone) / (1.0 - sensConfig.deadzone);
      const unitX = distance > 0 ? deltaX / distance : 0;
      const unitY = distance > 0 ? deltaY / distance : 0;

      effectiveDeltaX = unitX * scale * maxRadius;
      effectiveDeltaY = unitY * scale * maxRadius;

      // Target_x = Anchor_x + (Delta_x * S_x)
      // Target_y = Anchor_y + (Delta_y * S_y)
      // Converted to percentage representation relative to canvas width/height
      const pctDx = (effectiveDeltaX / rect.width) * 100 * sensConfig.sensX * 1.5;
      const pctDy = (effectiveDeltaY / rect.height) * 100 * sensConfig.sensY * 1.5;

      projTargetX = Math.max(0, Math.min(100, rightStickAnchor.x + pctDx));
      projTargetY = Math.max(0, Math.min(100, rightStickAnchor.y + pctDy));
    }

    setTelemetry({
      deltaX: Math.round(deltaX),
      deltaY: Math.round(deltaY),
      distance: Math.round(distance),
      normalizedDist: Math.round(normalizedDist * 100) / 100,
      effectiveDeltaX: Math.round(effectiveDeltaX),
      effectiveDeltaY: Math.round(effectiveDeltaY),
      projectedTargetX: Math.round(projTargetX * 10) / 10,
      projectedTargetY: Math.round(projTargetY * 10) / 10,
      inDeadzone,
    });
  };

  // Left Analog Stick (Movement) Math
  const processLeftStickMath = (clientX: number, clientY: number, rect: DOMRect) => {
    const stickCenterPxX = rect.left + (leftStickPos.x / 100) * rect.width;
    const stickCenterPxY = rect.top + (leftStickPos.y / 100) * rect.height;

    const deltaX = clientX - stickCenterPxX;
    const deltaY = clientY - stickCenterPxY;

    const maxRadius = 60;
    const distance = Math.hypot(deltaX, deltaY);

    let clampedKnobX = deltaX;
    let clampedKnobY = deltaY;

    if (distance > maxRadius) {
      clampedKnobX = (deltaX / distance) * maxRadius;
      clampedKnobY = (deltaY / distance) * maxRadius;
    }
    setLeftKnobOffset({ x: clampedKnobX, y: clampedKnobY });
  };

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* Top Floating Quick Controls Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-[#0c0f17]/95 border-b border-[#1f2638] backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff003f] animate-pulse"></span>
            <span className="font-orbitron font-bold text-xs tracking-wider text-white uppercase">
              ROG Virtual Console
            </span>
          </div>

          <div className="h-4 w-[1px] bg-gray-700 hidden sm:block"></div>

          {/* Mode Switcher */}
          <button
            onClick={onToggleEditMode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold tracking-wider transition-all cursor-pointer ${
              isEditMode
                ? 'bg-[#ff003f] text-white rog-red-glow'
                : 'bg-[#141926] text-gray-300 border border-[#2b354c] hover:border-gray-400'
            }`}
          >
            {isEditMode ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-white" />
                <span>⚙️ EDIT MODE (DRAGGABLE)</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>🔒 PLAY MODE (TOUCH ACTIVE)</span>
              </>
            )}
          </button>

          {/* Quick Presets */}
          <div className="hidden md:flex items-center gap-1.5 bg-[#121622] p-1 rounded-md border border-[#202738]">
            {['Free Fire Drag', 'PUBG / CODM', 'Genshin Impact'].map((pName) => (
              <button
                key={pName}
                onClick={() => onSelectPreset(pName)}
                className={`px-2 py-1 text-[11px] rounded transition-all cursor-pointer ${
                  activePresetName === pName
                    ? 'bg-[#00e5ff]/20 text-[#00e5ff] font-semibold border border-[#00e5ff]/40'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {pName}
              </button>
            ))}
          </div>
        </div>

        {/* Right Dock Controls */}
        <div className="flex items-center gap-2">
          {/* Backdrop Scene Selector */}
          <div className="flex items-center gap-1 bg-[#121622] p-0.5 rounded border border-[#202738] text-xs">
            <button
              onClick={() => setBackdropTheme('cyberpunk')}
              className={`px-2 py-0.5 rounded cursor-pointer ${backdropTheme === 'cyberpunk' ? 'bg-[#ff003f]/30 text-[#ff003f] font-bold' : 'text-gray-400'}`}
              title="Cyberpunk Arena Backdrop"
            >
              Cyber
            </button>
            <button
              onClick={() => setBackdropTheme('arena')}
              className={`px-2 py-0.5 rounded cursor-pointer ${backdropTheme === 'arena' ? 'bg-[#00e5ff]/30 text-[#00e5ff] font-bold' : 'text-gray-400'}`}
              title="Battleground Backdrop"
            >
              Shooter
            </button>
            <button
              onClick={() => setBackdropTheme('grid')}
              className={`px-2 py-0.5 rounded cursor-pointer ${backdropTheme === 'grid' ? 'bg-white/20 text-white font-bold' : 'text-gray-400'}`}
              title="Clean Blueprint Grid Backdrop"
            >
              Grid
            </button>
          </div>

          <button
            onClick={() => setShowSensitivityDrawer(!showSensitivityDrawer)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
              showSensitivityDrawer ? 'bg-[#00e5ff] text-black font-bold' : 'bg-[#151926] text-gray-300 hover:bg-[#1d2334] border border-[#2c354a]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Sensitivity ({sensConfig.sensX}x/{sensConfig.sensY}x)</span>
          </button>

          <button
            onClick={onResetLayout}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-[#151926] text-gray-400 hover:text-white hover:bg-[#1d2334] border border-[#2c354a] cursor-pointer"
            title="Reset layout to ROG Ally defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Sensitivity Quick Sliders Dropdown/Drawer */}
      {showSensitivityDrawer && (
        <div className="w-full bg-[#0d101a] border-b border-[#252c40] p-4 text-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 z-20 shadow-2xl">
          {/* X Sensitivity */}
          <div className="space-y-1">
            <div className="flex justify-between text-gray-300">
              <span className="font-semibold text-[#00e5ff]">X-Sensitivity (Horizontal Turn):</span>
              <span className="font-mono font-bold text-[#00e5ff]">{sensConfig.sensX.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="8.0"
              step="0.1"
              value={sensConfig.sensX}
              onChange={(e) => onUpdateSensConfig({ ...sensConfig, sensX: parseFloat(e.target.value) })}
              className="w-full accent-[#00e5ff] cursor-pointer"
            />
            <p className="text-[10px] text-gray-400">Controls horizontal look velocity multiplier.</p>
          </div>

          {/* Y Sensitivity (Drag Boost) */}
          <div className="space-y-1">
            <div className="flex justify-between text-gray-300">
              <span className="font-semibold text-[#ff003f]">Y-Sensitivity (Vertical Drag Boost):</span>
              <span className="font-mono font-bold text-[#ff003f]">{sensConfig.sensY.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="8.0"
              step="0.1"
              value={sensConfig.sensY}
              onChange={(e) => onUpdateSensConfig({ ...sensConfig, sensY: parseFloat(e.target.value) })}
              className="w-full accent-[#ff003f] cursor-pointer"
            />
            <p className="text-[10px] text-gray-400">High vertical multiplier for drag headshot & recoil control.</p>
          </div>

          {/* Deadzone */}
          <div className="space-y-1">
            <div className="flex justify-between text-gray-300">
              <span className="font-semibold text-purple-400">Radial Deadzone:</span>
              <span className="font-mono font-bold text-purple-400">{Math.round(sensConfig.deadzone * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.30"
              step="0.02"
              value={sensConfig.deadzone}
              onChange={(e) => onUpdateSensConfig({ ...sensConfig, deadzone: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <p className="text-[10px] text-gray-400">Eliminates micro-jitter & accidental camera drift.</p>
          </div>

          {/* Overlay Opacity */}
          <div className="space-y-1">
            <div className="flex justify-between text-gray-300">
              <span className="font-semibold text-gray-200">Overlay Opacity:</span>
              <span className="font-mono font-bold text-white">{Math.round(sensConfig.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={sensConfig.opacity}
              onChange={(e) => onUpdateSensConfig({ ...sensConfig, opacity: parseFloat(e.target.value) })}
              className="w-full accent-gray-200 cursor-pointer"
            />
            <p className="text-[10px] text-gray-400">Controls transparency over running mobile games.</p>
          </div>
        </div>
      )}

      {/* Main Interactive Gaming Canvas Viewport */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`relative w-full aspect-[20/9] max-h-[640px] bg-[#07090e] border border-[#232a3d] select-none overflow-hidden ${
          isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        }`}
        style={{
          boxShadow: isEditMode
            ? '0 0 30px rgba(255, 0, 63, 0.25), inset 0 0 30px rgba(255, 0, 63, 0.1)'
            : '0 0 30px rgba(0, 229, 255, 0.15)',
        }}
      >
        {/* Background Visual Game Scene Simulation */}
        <div className="absolute inset-0 pointer-events-none">
          {backdropTheme === 'cyberpunk' && (
            <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-[#0c0d1a] via-[#101322] to-[#080911]">
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 50% 50%, #3b82f6 1px, transparent 1px), radial-gradient(circle at 20% 80%, #ff003f 1.5px, transparent 1.5px)',
                  backgroundSize: '40px 40px, 80px 80px',
                }}
              ></div>
              {/* Perspective floor grid */}
              <div
                className="absolute bottom-0 w-full h-[55%] opacity-25"
                style={{
                  background: 'linear-gradient(to top, rgba(0,229,255,0.4) 1px, transparent 1px), linear-gradient(to right, rgba(0,229,255,0.15) 1px, transparent 1px)',
                  backgroundSize: '60px 30px',
                  transform: 'perspective(400px) rotateX(60deg)',
                  transformOrigin: 'bottom',
                }}
              ></div>
              {/* In-game HUD simulation elements */}
              <div className="absolute top-4 left-6 flex items-center gap-3 opacity-60">
                <div className="w-9 h-9 rounded-full bg-red-600/40 border border-red-500 flex items-center justify-center text-[10px] text-white font-bold">
                  HP
                </div>
                <div className="space-y-1">
                  <div className="w-32 h-2.5 bg-red-950 rounded-sm overflow-hidden border border-red-800">
                    <div className="w-[85%] h-full bg-gradient-to-r from-red-600 to-amber-500"></div>
                  </div>
                  <div className="w-24 h-1.5 bg-cyan-950 rounded-sm overflow-hidden">
                    <div className="w-[100%] h-full bg-cyan-400"></div>
                  </div>
                </div>
              </div>

              {/* Crosshair in the center */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-40">
                <div className="w-6 h-6 border border-cyan-400 rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                </div>
              </div>

              <div className="absolute top-4 right-6 text-right font-mono text-[10px] text-cyan-400 opacity-60">
                FPS: 120 | PING: 18ms | SENS: {sensConfig.sensX}x/{sensConfig.sensY}x
              </div>
            </div>
          )}

          {backdropTheme === 'arena' && (
            <div className="w-full h-full bg-gradient-to-b from-[#1b2333] via-[#0f1420] to-[#090b12] relative">
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                  backgroundSize: '50px 50px',
                }}
              ></div>
              <div className="absolute bottom-6 right-16 opacity-30 font-orbitron text-4xl font-black text-gray-600">
                ZONE 04
              </div>
            </div>
          )}

          {backdropTheme === 'grid' && (
            <div className="w-full h-full bg-[#080a10] relative">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'linear-gradient(#1a2336 1px, transparent 1px), linear-gradient(90deg, #1a2336 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              ></div>
            </div>
          )}

          {/* CRT Scanline overlay */}
          <div className="scanline-overlay absolute inset-0"></div>
        </div>

        {/* ========================================================= */}
        {/* SVG Vector Connecting Lines Overlay (Visible in Edit Mode) */}
        {/* ========================================================= */}
        {isEditMode && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <linearGradient id="lineGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff003f" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* Connecting lines for each Action Button to paired Target Pointer */}
            {buttons.map((btn) => (
              <g key={`line-${btn.id}`}>
                <line
                  x1={`${btn.x}%`}
                  y1={`${btn.y}%`}
                  x2={`${btn.targetX}%`}
                  y2={`${btn.targetY}%`}
                  stroke="url(#lineGlow)"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  className="animate-pulse"
                />
                <circle cx={`${btn.x}%`} cy={`${btn.y}%`} r="3" fill="#ff003f" />
                <circle cx={`${btn.targetX}%`} cy={`${btn.targetY}%`} r="3" fill="#00e5ff" />
              </g>
            ))}

            {/* Connecting line from Right Stick to Aim Anchor */}
            <line
              x1={`${rightStickPos.x}%`}
              y1={`${rightStickPos.y}%`}
              x2={`${rightStickAnchor.x}%`}
              y2={`${rightStickAnchor.y}%`}
              stroke="#ff003f"
              strokeWidth="2.5"
              strokeDasharray="8 4"
            />

            {/* Connecting line from Left Stick to Movement Anchor */}
            <line
              x1={`${leftStickPos.x}%`}
              y1={`${leftStickPos.y}%`}
              x2={`${leftStickAnchor.x}%`}
              y2={`${leftStickAnchor.y}%`}
              stroke="#00e5ff"
              strokeWidth="2.5"
              strokeDasharray="8 4"
            />
          </svg>
        )}

        {/* Live Touch Ripple Animations at Target Coordinates */}
        {touchRipples.map((ripple) => (
          <div
            key={ripple.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
            style={{ left: `${ripple.x}%`, top: `${ripple.y}%` }}
          >
            <div
              className="w-14 h-14 rounded-full border-2 animate-ping"
              style={{ borderColor: ripple.color, backgroundColor: `${ripple.color}33` }}
            ></div>
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-bold font-mono px-1 py-0.5 rounded shadow-lg text-white"
              style={{ backgroundColor: ripple.color }}
            >
              TAP {ripple.label}
            </div>
          </div>
        ))}

        {/* ========================================================= */}
        {/* LEFT ANALOG JOYSTICK (Movement Stick)                    */}
        {/* ========================================================= */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
          style={{
            left: `${leftStickPos.x}%`,
            top: `${leftStickPos.y}%`,
            opacity: sensConfig.opacity,
          }}
          onPointerDown={(e) => {
            if (isEditMode) {
              handlePointerDown(e, 'leftStick');
            } else {
              setIsLeftStickActive(true);
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }
          }}
        >
          {/* Outer RGB Glow Ring */}
          <div
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-cyan-400/80 bg-[#0f1422]/75 backdrop-blur-sm flex items-center justify-center relative shadow-lg"
            style={{
              boxShadow: '0 0 15px rgba(0, 229, 255, 0.3), inset 0 0 15px rgba(0, 229, 255, 0.1)',
            }}
          >
            {/* Center Deadzone Circle */}
            <div
              className="rounded-full border border-dashed border-gray-400/40 pointer-events-none"
              style={{
                width: `${sensConfig.deadzone * 100}%`,
                height: `${sensConfig.deadzone * 100}%`,
              }}
            ></div>

            {/* Inner Movable Knob */}
            <div
              className="w-12 h-12 rounded-full bg-gradient-to-b from-cyan-300 via-cyan-600 to-gray-900 border border-cyan-200 shadow-xl flex items-center justify-center transition-transform duration-75 pointer-events-none"
              style={{
                transform: `translate(${leftKnobOffset.x}px, ${leftKnobOffset.y}px)`,
              }}
            >
              <div className="w-4 h-4 rounded-full bg-white/40"></div>
            </div>

            {/* Label */}
            <span className="absolute -bottom-5 text-[10px] font-mono font-bold text-cyan-400">
              L-STICK (MOVE)
            </span>
          </div>
        </div>

        {/* Left Movement Anchor Target Indicator (Edit Mode or Anchor Visual) */}
        {(isEditMode || isLeftStickActive) && (
          <div
            className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 ${
              isEditMode ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
            }`}
            style={{ left: `${leftStickAnchor.x}%`, top: `${leftStickAnchor.y}%` }}
            onPointerDown={(e) => handlePointerDown(e, 'leftAnchor')}
          >
            <div className="flex items-center gap-1 bg-cyan-950/90 border border-cyan-400 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg">
              <Crosshair className="w-3 h-3 text-cyan-400" />
              <span>MOVE ANCHOR</span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* RIGHT ANALOG JOYSTICK (BlueStacks X/Y Sensitivity Engine) */}
        {/* ========================================================= */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
          style={{
            left: `${rightStickPos.x}%`,
            top: `${rightStickPos.y}%`,
            opacity: sensConfig.opacity,
          }}
          onPointerDown={(e) => {
            if (isEditMode) {
              handlePointerDown(e, 'rightStick');
            } else {
              setIsRightStickActive(true);
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }
          }}
        >
          {/* Outer ROG Red Glow Ring */}
          <div
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-[#ff003f] bg-[#140e15]/75 backdrop-blur-sm flex items-center justify-center relative shadow-lg"
            style={{
              boxShadow: '0 0 20px rgba(255, 0, 63, 0.4), inset 0 0 15px rgba(255, 0, 63, 0.2)',
            }}
          >
            {/* Center Deadzone Ring */}
            <div
              className="rounded-full border border-dashed border-red-400/40 pointer-events-none"
              style={{
                width: `${sensConfig.deadzone * 100}%`,
                height: `${sensConfig.deadzone * 100}%`,
              }}
            ></div>

            {/* Inner Movable Knob */}
            <div
              className="w-12 h-12 rounded-full bg-gradient-to-b from-rose-400 via-[#ff003f] to-gray-950 border border-red-300 shadow-xl flex items-center justify-center transition-transform duration-75 pointer-events-none"
              style={{
                transform: `translate(${rightKnobOffset.x}px, ${rightKnobOffset.y}px)`,
              }}
            >
              <div className="w-4 h-4 rounded-full bg-white/40"></div>
            </div>

            {/* Label */}
            <div className="absolute -bottom-5 flex items-center gap-1 text-[10px] font-mono font-bold text-[#ff003f]">
              <span>R-STICK ({sensConfig.sensX}x/{sensConfig.sensY}x)</span>
            </div>
          </div>
        </div>

        {/* Right Stick Aim Anchor Indicator */}
        {(isEditMode || isRightStickActive) && (
          <div
            className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 ${
              isEditMode ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
            }`}
            style={{ left: `${rightStickAnchor.x}%`, top: `${rightStickAnchor.y}%` }}
            onPointerDown={(e) => handlePointerDown(e, 'rightAnchor')}
          >
            <div className="flex items-center gap-1 bg-red-950/90 border border-red-500 text-red-200 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg">
              <Crosshair className="w-3 h-3 text-red-400 animate-spin" />
              <span>AIM ANCHOR ({rightStickAnchor.x.toFixed(0)}%, {rightStickAnchor.y.toFixed(0)}%)</span>
            </div>
          </div>
        )}

        {/* Live Aim Camera Swipe Projection Node (Visible when touching Right Stick) */}
        {!isEditMode && isRightStickActive && !telemetry.inDeadzone && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-25 pointer-events-none"
            style={{ left: `${telemetry.projectedTargetX}%`, top: `${telemetry.projectedTargetY}%` }}
          >
            <div className="w-8 h-8 rounded-full border-2 border-[#ff003f] bg-[#ff003f]/20 animate-ping"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-mono text-[#ff003f] font-bold whitespace-nowrap bg-black/80 px-1 rounded">
              SWIPE TARGET
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CONSOLE ACTION BUTTONS (A, B, X, Y, L1, R1, D-PAD)       */}
        {/* ========================================================= */}
        {buttons.map((btn) => (
          <React.Fragment key={btn.id}>
            {/* 1. Gamepad Button */}
            <div
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 ${
                isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer active:scale-90'
              } transition-transform duration-75`}
              style={{
                left: `${btn.x}%`,
                top: `${btn.y}%`,
                opacity: sensConfig.opacity,
              }}
              onPointerDown={(e) => {
                if (isEditMode) {
                  handlePointerDown(e, 'button', btn.id);
                } else {
                  handleButtonClick(btn);
                }
              }}
            >
              <div
                className="rounded-full flex items-center justify-center font-orbitron font-bold text-white shadow-xl transition-all"
                style={{
                  width: `${btn.size * sensConfig.buttonScale}px`,
                  height: `${btn.size * sensConfig.buttonScale}px`,
                  backgroundColor: '#121620e6',
                  border: `2px solid ${btn.color}`,
                  boxShadow: `0 0 10px ${btn.color}44`,
                }}
              >
                <span className="text-sm select-none">{btn.label}</span>
              </div>
            </div>

            {/* 2. Paired Target Pointer Node (Visible in Edit Mode) */}
            {isEditMode && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-grab active:cursor-grabbing"
                style={{ left: `${btn.targetX}%`, top: `${btn.targetY}%` }}
                onPointerDown={(e) => handlePointerDown(e, 'pointer', btn.id)}
              >
                <div
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white shadow-lg flex items-center gap-1"
                  style={{
                    backgroundColor: '#0c101be6',
                    border: `1.5px solid ${btn.color}`,
                  }}
                >
                  <Crosshair className="w-3 h-3 text-cyan-400" />
                  <span>🎯 {btn.label}</span>
                </div>
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Edit Mode Instruction Banner */}
        {isEditMode && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#0c101a]/90 border border-[#ff003f] px-4 py-1.5 rounded-full text-xs text-white font-mono flex items-center gap-2 shadow-2xl z-30">
            <Unlock className="w-3.5 h-3.5 text-[#ff003f]" />
            <span>EDIT MODE: Drag any Button or Target Pointer (🎯) to reposition</span>
          </div>
        )}
      </div>

      {/* Real-Time Telemetry & Engine Inspector Strip */}
      <div className="w-full bg-[#0a0d15] border-t border-[#1f2638] px-4 py-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs font-mono">
        <div className="bg-[#111624] p-2 rounded border border-[#1e2538]">
          <span className="text-gray-400 text-[10px] block">RADIAL DISPLACEMENT</span>
          <span className="text-[#00e5ff] font-bold text-sm">
            ΔX: {telemetry.deltaX}px, ΔY: {telemetry.deltaY}px
          </span>
        </div>

        <div className="bg-[#111624] p-2 rounded border border-[#1e2538]">
          <span className="text-gray-400 text-[10px] block">POLAR DISTANCE (D)</span>
          <span className="text-white font-bold text-sm">
            {telemetry.distance}px / 60px
          </span>
        </div>

        <div className="bg-[#111624] p-2 rounded border border-[#1e2538]">
          <span className="text-gray-400 text-[10px] block">DEADZONE STATUS</span>
          <span className={`font-bold text-sm ${telemetry.inDeadzone ? 'text-amber-400' : 'text-emerald-400'}`}>
            {telemetry.inDeadzone ? 'DEADZONE (DRIFT CUT)' : 'ACTIVE DEFLECTION'}
          </span>
        </div>

        <div className="bg-[#111624] p-2 rounded border border-[#1e2538]">
          <span className="text-gray-400 text-[10px] block">BLUESTACKS MULTIPLIERS</span>
          <span className="text-[#ff003f] font-bold text-sm">
            Sx: {sensConfig.sensX}x | Sy: {sensConfig.sensY}x
          </span>
        </div>

        <div className="bg-[#111624] p-2 rounded border border-[#1e2538]">
          <span className="text-gray-400 text-[10px] block">SYNTHESIZED TARGET (TX, TY)</span>
          <span className="text-cyan-300 font-bold text-sm">
            {telemetry.projectedTargetX}%, {telemetry.projectedTargetY}%
          </span>
        </div>

        <div className="bg-[#111624] p-2 rounded border border-[#1e2538]">
          <span className="text-gray-400 text-[10px] block">TOUCH DISPATCH LATENCY</span>
          <span className="text-emerald-400 font-bold text-sm flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>~2.4 ms (Zero Root)</span>
          </span>
        </div>
      </div>
    </div>
  );
};
