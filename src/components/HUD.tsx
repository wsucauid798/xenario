import { useEffect, useRef, useState } from 'react';

interface Props {
  sceneIndex: number;
  totalScenes: number;
  showHints: boolean;
}

export function HUD({ sceneIndex, totalScenes, showHints }: Props) {
  const [hintsVisible, setHintsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneMarkers = Array.from(
    { length: totalScenes },
    (_, i) => `scene-${i + 1}`,
  );

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
            ? 'Drag to look · Touch left side to move'
            : 'Click to look around · WASD to move'}
        </p>
      </div>

      {/* Scene progress dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
        {sceneMarkers.map((sceneId, i) => (
          <div
            key={sceneId}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
              i === sceneIndex
                ? 'bg-white/60'
                : i < sceneIndex
                  ? 'bg-white/20'
                  : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
