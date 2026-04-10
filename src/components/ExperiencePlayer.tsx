import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { InputManager } from '../modules/InputManager';
import { LimitedLookController } from '../modules/LimitedLookController';
import type { PointCloudAsset } from '../modules/PointCloudAsset';
import { PointCloudRenderer } from '../modules/PointCloudRenderer';
import { SceneTransition } from '../modules/SceneTransition';
import type { TourCameraConfig } from '../modules/TourCamera';
import { TourCamera } from '../modules/TourCamera';
import { HUD } from './HUD';

/** Scene metadata as loaded from meta.json (runtime shape). */
export interface SceneMeta {
  cameraPath: {
    duration: number;
    waypoints: [number, number, number][];
  };
  floor: {
    height: number;
    confidence: number;
  };
  walkable: {
    samples: {
      t: number;
      center: [number, number, number];
      width: number;
      floorHeight: number;
    }[];
    minBound: [number, number, number];
    maxBound: [number, number, number];
  };
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
    size: [number, number, number];
  };
}

export interface LoadedScene {
  asset: PointCloudAsset;
  meta: SceneMeta;
}

interface Props {
  initialScene: LoadedScene;
  sceneIndex: number;
  totalScenes: number;
  preloadedNext: LoadedScene | null;
  onSceneSwap: () => void;
  onTourEnd: () => void;
}

function deriveWalkableBounds(meta: SceneMeta): {
  min: THREE.Vector3;
  max: THREE.Vector3;
} {
  const fallback = {
    min: new THREE.Vector3(...meta.walkable.minBound),
    max: new THREE.Vector3(...meta.walkable.maxBound),
  };
  const samples = meta.walkable.samples;

  if (samples.length === 0) {
    return fallback;
  }

  const padding = 0.75;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    const tangentX = next.center[0] - prev.center[0];
    const tangentZ = next.center[2] - prev.center[2];
    const lateral = new THREE.Vector2(-tangentZ, tangentX);

    if (lateral.lengthSq() < 1e-6) {
      lateral.set(1, 0);
    } else {
      lateral.normalize();
    }

    const halfWidth = sample.width / 2 + padding;
    const candidates = [
      [sample.center[0], sample.center[2]],
      [
        sample.center[0] - lateral.x * halfWidth,
        sample.center[2] - lateral.y * halfWidth,
      ],
      [
        sample.center[0] + lateral.x * halfWidth,
        sample.center[2] + lateral.y * halfWidth,
      ],
    ];

    for (const [x, z] of candidates) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minZ) ||
    !Number.isFinite(maxZ)
  ) {
    return fallback;
  }

  return {
    min: new THREE.Vector3(
      Math.max(meta.bounds.min[0] + padding, minX - padding),
      meta.walkable.minBound[1],
      Math.max(meta.bounds.min[2] + padding, minZ - padding),
    ),
    max: new THREE.Vector3(
      Math.min(meta.bounds.max[0] - padding, maxX + padding),
      meta.walkable.maxBound[1],
      Math.min(meta.bounds.max[2] - padding, maxZ + padding),
    ),
  };
}

function buildTourCameraConfig(meta: SceneMeta): TourCameraConfig {
  const walkableBounds = deriveWalkableBounds(meta);

  return {
    guidePath: meta.cameraPath.waypoints.map(
      ([x, y, z]) => new THREE.Vector3(x, y, z),
    ),
    pathDuration: meta.cameraPath.duration,
    heightSamples: meta.walkable.samples.map((s) => ({
      t: s.t,
      height: s.floorHeight,
    })),
    baseFloorHeight: meta.floor.height,
    eyeHeight: 1.6,
    moveSpeed: 0.7,
    walkableMin: walkableBounds.min,
    walkableMax: walkableBounds.max,
  };
}

export function ExperiencePlayer({
  initialScene,
  sceneIndex,
  totalScenes,
  preloadedNext,
  onSceneSwap,
  onTourEnd,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showHints, setShowHints] = useState(true);

  // Refs for values that change between renders but are read in the animation loop
  const preloadRef = useRef(preloadedNext);
  preloadRef.current = preloadedNext;
  const sceneIndexRef = useRef(sceneIndex);
  sceneIndexRef.current = sceneIndex;
  const onSceneSwapRef = useRef(onSceneSwap);
  onSceneSwapRef.current = onSceneSwap;
  const onTourEndRef = useRef(onTourEnd);
  onTourEndRef.current = onTourEnd;
  const totalScenesRef = useRef(totalScenes);
  totalScenesRef.current = totalScenes;

  // Show hints briefly each time sceneIndex changes
  useEffect(() => {
    setShowHints(sceneIndex >= 0);
    const t = setTimeout(() => setShowHints(false), 5000);
    return () => clearTimeout(t);
  }, [sceneIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // ── Camera ────────────────────────────────────────────────────────────────
    const { bounds } = initialScene.asset;
    const diag = bounds.diagonal;
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      diag * 0.001,
      diag * 3,
    );

    // ── Point cloud ───────────────────────────────────────────────────────────
    let baseFogNear = diag * 0.6;
    let baseFogFar = diag * 1.4;
    let pointCloud = new PointCloudRenderer(initialScene.asset.geometry, {
      pointSize: 2,
      fogNear: baseFogNear,
      fogFar: baseFogFar,
      fogColor: new THREE.Color(0x000000),
    });
    scene.add(pointCloud.mesh);

    // ── Controllers ───────────────────────────────────────────────────────────
    const tourCamera = new TourCamera(buildTourCameraConfig(initialScene.meta));
    const lookController = new LimitedLookController({ springBack: true });
    lookController.attach(renderer.domElement);
    const inputManager = new InputManager();
    inputManager.attach(renderer.domElement);
    const transition = new SceneTransition();

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    // ── Scene swap ────────────────────────────────────────────────────────────
    function swapScene(next: LoadedScene) {
      // Remove old geometry
      scene.remove(pointCloud.mesh);
      pointCloud.dispose();

      // Create new point cloud with fog starting fully closed
      const newDiag = next.asset.bounds.diagonal;
      baseFogNear = newDiag * 0.6;
      baseFogFar = newDiag * 1.4;
      pointCloud = new PointCloudRenderer(next.asset.geometry, {
        pointSize: 2,
        fogNear: 0,
        fogFar: 0.01,
        fogColor: new THREE.Color(0x000000),
      });
      scene.add(pointCloud.mesh);

      // Reconfigure tour camera
      tourCamera.configure(buildTourCameraConfig(next.meta));

      // Update THREE camera frustum for new scene scale
      camera.near = newDiag * 0.001;
      camera.far = newDiag * 3;
      camera.updateProjectionMatrix();

      // Begin fog opening
      transition.beginOpen();

      // Reset look
      lookController.recenter();
    }

    // ── Render loop ───────────────────────────────────────────────────────────
    let lastTime = performance.now();
    let rafId = 0;

    const loop = (now: number) => {
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // 1. Read input
      const input = inputManager.getState();

      // 2. Update look controller
      lookController.update(delta);

      // 3. Update tour camera (auto-drift or manual movement)
      tourCamera.update(delta, input, lookController.yawAngle);

      // 4. Apply to THREE camera
      camera.position.copy(tourCamera.position);
      camera.quaternion
        .copy(tourCamera.baseQuaternion)
        .multiply(lookController.offsetQuaternion);

      // 5. Check transition trigger
      const isLastScene = sceneIndexRef.current >= totalScenesRef.current - 1;
      transition.checkTrigger(tourCamera.guideT, isLastScene ? 0.95 : 0.92);

      // 6. Update transition fog
      transition.update(delta);
      if (transition.phase !== 'idle') {
        pointCloud.setFog(
          transition.computeFogNear(baseFogNear),
          transition.computeFogFar(baseFogFar),
        );
      }

      // 7. Handle fog_hold: swap scene or end tour
      if (transition.isFullyClosed()) {
        if (isLastScene) {
          onTourEndRef.current();
        } else {
          const next = preloadRef.current;
          if (next) {
            swapScene(next);
            onSceneSwapRef.current();
          }
          // else: hold on black, keep waiting for preload
        }
      }

      // 8. Render
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      lookController.detach();
      inputManager.detach();
      pointCloud.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [initialScene]);

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={containerRef} className="w-full h-full" />
      <HUD
        sceneIndex={sceneIndex}
        totalScenes={totalScenes}
        showHints={showHints}
      />
    </div>
  );
}
