import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Crosshair,
  UploadCloud,
  Gauge,
  Circle,
} from 'lucide-react';

interface Props {
  playing: boolean;
  progress: number;
  pointSize: number;
  speed: number;
  onPlayPause: () => void;
  onRecenter: () => void;
  onSeek: (t: number) => void;
  onPointSizeChange: (size: number) => void;
  onSpeedChange: (speed: number) => void;
  onUnload: () => void;
}

export function HUD({
  playing,
  progress,
  pointSize,
  speed,
  onPlayPause,
  onRecenter,
  onSeek,
  onPointSizeChange,
  onSpeedChange,
  onUnload,
}: Props) {
  const [visible, setVisible] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const resetHideTimer = useCallback(() => {
    setVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    const onMove = () => resetHideTimer();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchstart', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchstart', onMove);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // Spacebar play/pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); onPlayPause(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPlayPause]);

  const onProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(t);
  };

  const pct = `${(progress * 100).toFixed(1)}%`;

  return (
    <div
      className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
        {/* Progress bar */}
        <div
          ref={progressBarRef}
          className="w-full h-1.5 bg-white/20 cursor-pointer hover:h-2.5 transition-all group"
          onClick={onProgressClick}
        >
          <div
            className="h-full bg-white/80 group-hover:bg-white transition-colors"
            style={{ width: pct }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent">
          {/* Play / Pause */}
          <button
            onClick={onPlayPause}
            className="text-white/80 hover:text-white transition-colors"
            title="Play / Pause (Space)"
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>

          {/* Progress text */}
          <span className="text-white/50 text-xs tabular-nums">{pct}</span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Recenter */}
          <button
            onClick={onRecenter}
            className="text-white/80 hover:text-white transition-colors"
            title="Recenter look"
          >
            <Crosshair size={18} />
          </button>

          {/* Controls toggle */}
          <button
            onClick={() => setShowControls(v => !v)}
            className={`transition-colors ${showControls ? 'text-white' : 'text-white/80 hover:text-white'}`}
            title="Settings"
          >
            <Gauge size={18} />
          </button>

          {/* Load new scene */}
          <button
            onClick={onUnload}
            className="text-white/80 hover:text-white transition-colors"
            title="Load new scene"
          >
            <UploadCloud size={18} />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showControls && (
        <div className="absolute bottom-16 right-4 pointer-events-auto bg-black/70 backdrop-blur-sm rounded-xl p-4 flex flex-col gap-4 min-w-48 text-white text-sm">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-white/60">
              <Circle size={12} />
              Point size
              <span className="ml-auto tabular-nums">{pointSize.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={6}
              step={0.1}
              value={pointSize}
              onChange={e => onPointSizeChange(parseFloat(e.target.value))}
              className="w-full accent-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-white/60">
              <Gauge size={12} />
              Speed
              <span className="ml-auto tabular-nums">{speed.toFixed(1)}×</span>
            </label>
            <input
              type="range"
              min={0.25}
              max={3}
              step={0.05}
              value={speed}
              onChange={e => onSpeedChange(parseFloat(e.target.value))}
              className="w-full accent-white"
            />
          </div>
        </div>
      )}

      {/* Pointer lock hint */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <p className="text-white/40 text-xs">Click canvas to look around · Esc to release</p>
      </div>
    </div>
  );
}
