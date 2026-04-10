import { useEffect, useRef, useState } from 'react';

interface Props {
  sceneIndex: number;
  showHints: boolean;
  tourSpeed: number;
  paused: boolean;
}

export function HUD({ sceneIndex, showHints, tourSpeed, paused }: Props) {
  const [hintsVisible, setHintsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show hints on scene entry, fade after 5 seconds
  useEffect(() => {
    if (showHints && sceneIndex >= 0) {
      setHintsVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHintsVisible(false), 5000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showHints, sceneIndex]);

  // Detect touch device
  const isMobile =
    typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Center crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-1 h-1 rounded-full bg-white/30" />
      </div>

      {/* Control hints */}
      <div
        className={`absolute top-6 left-1/2 -translate-x-1/2 transition-opacity duration-1000 ${
          hintsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <p className="text-white/50 text-xs text-center whitespace-nowrap">
          {isMobile
            ? 'Drag to look · Touch left side to move/speed · P pauses on keyboard'
            : 'Click to look · W/↑ faster · S/↓ slower · A/D drift · +/- speed · P pause'}
        </p>
      </div>

      <div className="absolute top-6 right-6 text-right">
        <p className="text-[10px] tracking-[0.2em] text-white/35 uppercase">
          {paused ? 'Paused' : 'Tour Speed'}
        </p>
        <p className="text-sm text-white/55">
          {paused ? 'P to resume' : `${tourSpeed.toFixed(2)}x`}
        </p>
      </div>
    </div>
  );
}
