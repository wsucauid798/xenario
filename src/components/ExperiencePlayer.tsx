import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { PointCloudAsset } from '../modules/PointCloudAsset';
import { PointCloudRenderer } from '../modules/PointCloudRenderer';
import { RailCamera, generateAutoPath } from '../modules/RailCamera';
import type { PathConfig } from '../modules/RailCamera';
import { LimitedLookController } from '../modules/LimitedLookController';
import { HUD } from './HUD';

interface Props {
  asset: PointCloudAsset;
  pathConfig?: PathConfig;
  onUnload: () => void;
}

export function ExperiencePlayer({ asset, pathConfig, onUnload }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    railCamera: RailCamera;
    lookController: LimitedLookController;
    pointCloud: PointCloudRenderer;
    rafId: number;
    lastTime: number;
    speedMultiplier: number;
  } | null>(null);

  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [pointSize, setPointSize] = useState(2);
  const [speed, setSpeed] = useState(1);
  const [ended, setEnded] = useState(false);

  const onPlayPause = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.railCamera.playing) {
      s.railCamera.pause();
      setPlaying(false);
    } else {
      if (ended) {
        s.railCamera.reset();
        s.railCamera.play();
        setEnded(false);
      } else {
        s.railCamera.play();
      }
      setPlaying(true);
    }
  }, [ended]);

  const onRecenter = useCallback(() => {
    stateRef.current?.lookController.recenter();
  }, []);

  const onSeek = useCallback((t: number) => {
    const s = stateRef.current;
    if (!s) return;
    s.railCamera.seek(t);
    setProgress(t);
  }, []);

  const onPointSizeChange = useCallback((size: number) => {
    setPointSize(size);
    stateRef.current?.pointCloud.setPointSize(size);
  }, []);

  const onSpeedChange = useCallback((s: number) => {
    setSpeed(s);
    if (stateRef.current) stateRef.current.speedMultiplier = s;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    // ── Scene ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // ── Camera ───────────────────────────────────────────────────────────────
    const { bounds } = asset;
    const diag = bounds.diagonal;
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      diag * 0.001,
      diag * 3,
    );

    // ── Point cloud ──────────────────────────────────────────────────────────
    const fogNear = diag * 0.6;
    const fogFar = diag * 1.4;
    const pointCloud = new PointCloudRenderer(asset.geometry, {
      pointSize,
      fogNear,
      fogFar,
      fogColor: new THREE.Color(0x000000),
    });
    scene.add(pointCloud.mesh);

    // ── Rail camera ──────────────────────────────────────────────────────────
    const config = pathConfig ?? generateAutoPath(bounds);
    const railCamera = new RailCamera(config);
    railCamera.play();

    // ── Look controller ──────────────────────────────────────────────────────
    const lookController = new LimitedLookController({ springBack: true });
    lookController.attach(renderer.domElement);

    // ── Resize ───────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    // ── Render loop ──────────────────────────────────────────────────────────
    let rafId = 0;
    let lastTime = performance.now();

    const state = {
      renderer,
      scene,
      camera,
      railCamera,
      lookController,
      pointCloud,
      rafId,
      lastTime,
      speedMultiplier: speed,
    };
    stateRef.current = state;

    const loop = (now: number) => {
      const delta = Math.min((now - state.lastTime) / 1000, 0.1);
      state.lastTime = now;

      state.railCamera.advance(delta, state.speedMultiplier);
      state.lookController.update(delta);

      camera.position.copy(state.railCamera.position);
      camera.quaternion
        .copy(state.railCamera.baseQuaternion)
        .multiply(state.lookController.offsetQuaternion);

      const t = state.railCamera.t;
      setProgress(t);

      if (t >= 1 && !state.railCamera.playing) {
        setPlaying(false);
        setEnded(true);
      }

      renderer.render(scene, camera);
      state.rafId = requestAnimationFrame(loop);
    };

    state.rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(state.rafId);
      resizeObserver.disconnect();
      lookController.detach();
      pointCloud.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, pathConfig]);

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={containerRef} className="w-full h-full" />
      <HUD
        playing={playing}
        progress={progress}
        pointSize={pointSize}
        speed={speed}
        onPlayPause={onPlayPause}
        onRecenter={onRecenter}
        onSeek={onSeek}
        onPointSizeChange={onPointSizeChange}
        onSpeedChange={onSpeedChange}
        onUnload={onUnload}
      />
    </div>
  );
}
