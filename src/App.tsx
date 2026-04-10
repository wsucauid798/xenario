import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import type { LoadedScene, SceneMeta } from './components/ExperiencePlayer';
import { ExperiencePlayer } from './components/ExperiencePlayer';
import { LoadingScreen } from './components/LoadingScreen';
import { loadPLYFromUrl } from './modules/PointCloudAsset';

/* ── Manifest types ─────────────────────────────────────────────────────────── */

interface TourManifest {
  version: number;
  scenes: {
    sceneId: string;
    plyFile: string;
    metaFile: string;
    entryPoint: [number, number, number];
    exitPoint: [number, number, number];
  }[];
  totalDuration: number;
}

/* ── Scene loading ──────────────────────────────────────────────────────────── */

function squaredDistance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

function orientSceneMeta(
  sceneEntry: TourManifest['scenes'][number],
  meta: SceneMeta,
): SceneMeta {
  const waypoints = meta.cameraPath.waypoints;
  const samples = meta.walkable.samples;

  if (waypoints.length < 2) {
    return meta;
  }

  const forwardScore =
    squaredDistance(sceneEntry.entryPoint, waypoints[0]) +
    squaredDistance(sceneEntry.exitPoint, waypoints[waypoints.length - 1]);
  const reverseScore =
    squaredDistance(sceneEntry.entryPoint, waypoints[waypoints.length - 1]) +
    squaredDistance(sceneEntry.exitPoint, waypoints[0]);

  if (reverseScore >= forwardScore) {
    return meta;
  }

  return {
    ...meta,
    cameraPath: {
      ...meta.cameraPath,
      waypoints: [...waypoints]
        .reverse()
        .map((waypoint) => [...waypoint] as [number, number, number]),
    },
    walkable: {
      ...meta.walkable,
      samples: [...samples]
        .reverse()
        .map((sample) => ({
          ...sample,
          t: 1 - sample.t,
          center: [...sample.center] as [number, number, number],
        }))
        .sort((a, b) => a.t - b.t),
    },
  };
}

async function loadScene(
  manifest: TourManifest,
  index: number,
): Promise<LoadedScene> {
  const entry = manifest.scenes[index];
  const [asset, metaRes] = await Promise.all([
    loadPLYFromUrl(`/scenes/${entry.plyFile}`),
    fetch(`/scenes/${entry.metaFile}`),
  ]);
  const meta: SceneMeta = await metaRes.json();
  return { asset, meta: orientSceneMeta(entry, meta) };
}

/* ── App ────────────────────────────────────────────────────────────────────── */

export default function App() {
  const [manifest, setManifest] = useState<TourManifest | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [currentScene, setCurrentScene] = useState<LoadedScene | null>(null);
  const [preloadedNext, setPreloadedNext] = useState<LoadedScene | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [tourEnded, setTourEnded] = useState(false);

  // Track which scene index we've started preloading
  const preloadingRef = useRef(-1);

  // Fetch manifest + first scene on mount
  useEffect(() => {
    fetch('/scenes/manifest.json')
      .then((r) => r.json())
      .then((m: TourManifest) => {
        setManifest(m);
        return loadScene(m, 0);
      })
      .then((loaded) => {
        setCurrentScene(loaded);
        setInitialLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load tour:', err);
      });
  }, []);

  // Preload next scene whenever sceneIndex or manifest changes
  useEffect(() => {
    if (!manifest) return;
    const nextIdx = sceneIndex + 1;
    if (nextIdx >= manifest.scenes.length) return;
    if (preloadingRef.current === nextIdx) return; // already preloading this one

    preloadingRef.current = nextIdx;
    setPreloadedNext(null); // clear any previous preload

    let cancelled = false;
    loadScene(manifest, nextIdx)
      .then((loaded) => {
        if (!cancelled) setPreloadedNext(loaded);
      })
      .catch((err) => {
        console.error(`Failed to preload scene ${nextIdx + 1}:`, err);
      });

    return () => {
      cancelled = true;
    };
  }, [manifest, sceneIndex]);

  const onSceneSwap = useCallback(() => {
    // Advance to next scene — the preloaded scene becomes current
    setSceneIndex((prev) => {
      const next = prev + 1;
      // Move preloaded to current
      setCurrentScene(preloadedNext);
      setPreloadedNext(null);
      preloadingRef.current = -1; // allow preloading the next one
      return next;
    });
  }, [preloadedNext]);

  const onTourEnd = useCallback(() => {
    setTourEnded(true);
  }, []);

  const onBegin = useCallback(() => {
    setStarted(true);
  }, []);

  const onRestart = useCallback(() => {
    if (!manifest) return;
    setTourEnded(false);
    setStarted(false);
    setSceneIndex(0);
    setCurrentScene(null);
    setPreloadedNext(null);
    preloadingRef.current = -1;
    setInitialLoading(true);

    loadScene(manifest, 0).then((loaded) => {
      setCurrentScene(loaded);
      setInitialLoading(false);
    });
  }, [manifest]);

  // Tour ended screen
  if (tourEnded) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-10 select-none">
        <div className="flex flex-col items-center gap-4">
          <h1 className="experience-display-title text-white text-5xl sm:text-6xl lg:text-7xl leading-none text-center animate-[fadeIn_2s_ease-out]">
            7th Month Return
          </h1>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <p className="max-w-md text-center text-sm leading-6 text-stone-400">
            Nine scanned passages, one continuous return.
          </p>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="group relative px-10 py-3"
        >
          <span className="absolute inset-0 border border-white/20 rounded-full group-hover:border-white/50 transition-colors duration-500" />
          <span className="experience-button-glow absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <span className="relative text-white/60 group-hover:text-white text-sm tracking-[0.2em] uppercase transition-colors duration-500">
            Experience again
          </span>
        </button>
        <p className="text-xs text-stone-500">
          Developed by{' '}
          <a
            href="https://williamsawyerr.net"
            target="_blank"
            rel="noreferrer"
            className="experience-footer-link transition-colors duration-300 hover:text-amber-100"
          >
            William Sawyerr
          </a>
        </p>
      </div>
    );
  }

  // Title screen: shows while loading, then shows "Begin" button when ready
  if (!started) {
    return (
      <LoadingScreen
        ready={!initialLoading && !!currentScene}
        onBegin={onBegin}
      />
    );
  }

  // Safety: shouldn't happen, but just in case
  if (!currentScene || !manifest) {
    return <LoadingScreen ready={false} onBegin={onBegin} />;
  }

  // Playing
  return (
    <div className="w-full h-full">
      <ExperiencePlayer
        initialScene={currentScene}
        sceneIndex={sceneIndex}
        totalScenes={manifest.scenes.length}
        preloadedNext={preloadedNext}
        onSceneSwap={onSceneSwap}
        onTourEnd={onTourEnd}
      />
    </div>
  );
}
