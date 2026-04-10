import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compositeScene } from './lib/compositer.ts';
import { voxelDownsample } from './lib/downsampler.ts';
import { createLogger } from './lib/logger.ts';
import { generateCameraPath } from './lib/pathGenerator.ts';
import { parsePLY } from './lib/plyParser.ts';
import { writePLY } from './lib/plyWriter.ts';
import {
  computeAABB,
  computePCA,
  computeWalkableCorridor,
  detectBoundaries,
  detectFloor,
} from './lib/spatialAnalyzer.ts';
import { stitchTour } from './lib/tourStitcher.ts';
import type { PointCloud, SceneDefinition, SceneMeta } from './lib/types.ts';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const RAW_SCENES_DIR = resolve(SCRIPT_DIR, '..', 'data', 'raw-scenes');
const PUBLIC_SCENES_DIR = resolve(SCRIPT_DIR, '..', 'public', 'scenes');
const OUTPUT_DIR = join(PUBLIC_SCENES_DIR, 'optimized');
const TARGET_POINTS = 3_000_000;

// Scene definitions — empty files array means auto-discover all .ply in the dir
const SCENE_DEFS: SceneDefinition[] = [
  {
    id: 'scene_1',
    files: ['Village_Steert_24.06.23_4.ply'],
    format: 'scanner',
  },
  { id: 'scene_2', files: ['02_Scan at 17.15.ply'], format: 'sitescape' },
  { id: 'scene_3', files: [], format: 'sitescape' },
  { id: 'scene_4', files: ['04_Scan at 17.39.ply'], format: 'sitescape' },
  { id: 'scene_5', files: [], format: 'sitescape' },
  { id: 'scene_6', files: ['06_Scan at 14.48.ply'], format: 'sitescape' },
  { id: 'scene_7', files: [], format: 'sitescape' },
  { id: 'scene_8', files: ['08_Scan at 14.13.ply'], format: 'sitescape' },
  { id: 'scene_9', files: ['Village_Tree_24.06.28.ply'], format: 'scanner' },
];

function discoverFiles(sceneId: string): string[] {
  const dir = join(RAW_SCENES_DIR, sceneId);
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.ply'))
    .sort()
    .map((f) => join(dir, f));
}

function resolveFiles(def: SceneDefinition): string[] {
  if (def.files.length > 0) {
    return def.files.map((f) => join(RAW_SCENES_DIR, def.id, f));
  }
  return discoverFiles(def.id);
}

function processScene(
  def: SceneDefinition,
  log: ReturnType<typeof createLogger>,
): SceneMeta {
  log.info(`Processing ${def.id}...`);

  // 1. Parse (and composite if multi-file)
  const files = resolveFiles(def);
  log.step(`${files.length} file(s) to load`);

  let cloud: PointCloud;
  if (files.length === 1) {
    cloud = parsePLY(files[0]);
  } else {
    cloud = compositeScene(files, def.format);
  }
  log.step(`Loaded ${cloud.count.toLocaleString()} points`);

  // 2. Bounding box
  log.step('Computing bounding box...');
  const bounds = computeAABB(cloud.positions, cloud.count);
  log.step(
    `Bounds: ${bounds.size.map((s) => s.toFixed(2)).join(' x ')} ` +
      `(min: ${bounds.min.map((v) => v.toFixed(2)).join(', ')})`,
  );

  // 3. PCA
  log.step('Running PCA...');
  const pca = computePCA(cloud.positions, cloud.count);
  log.step(
    `Principal axis: [${pca.eigenvectors[0].map((v) => v.toFixed(3)).join(', ')}] ` +
      `(eigenvalue ratio: ${(pca.eigenvalues[0] / pca.eigenvalues[2]).toFixed(1)}:1)`,
  );

  // 4. Floor detection
  log.step('Detecting floor plane...');
  const floor = detectFloor(cloud.positions, cloud.count, bounds);
  log.step(
    `Floor height: ${floor.height.toFixed(2)}, ` +
      `normal: [${floor.normal.map((v) => v.toFixed(3)).join(', ')}], ` +
      `inlier ratio: ${(floor.inlierRatio * 100).toFixed(1)}%`,
  );

  // 5. Boundary detection
  log.step('Detecting boundaries...');
  const boundary = detectBoundaries(
    cloud.positions,
    cloud.count,
    pca.eigenvectors[0],
    pca.mean,
  );
  log.step(
    `Principal length: ${boundary.principalLength.toFixed(2)}m ` +
      `(start density: ${boundary.startDensity}, end density: ${boundary.endDensity})`,
  );

  // 6. Generate initial camera path (needed for corridor analysis)
  log.step('Generating initial camera path...');
  const initialPath = generateCameraPath(
    pca.eigenvectors[0],
    pca.eigenvectors[1],
    boundary,
    floor.height,
    null, // no corridor yet
  );

  // 7. Compute walkable corridor + height profile
  log.step('Computing walkable corridor...');
  const walkable = computeWalkableCorridor(
    cloud.positions,
    cloud.count,
    initialPath,
    pca.eigenvectors[0],
    pca.eigenvectors[1],
    floor,
    bounds,
  );
  log.step(
    `Corridor: ${walkable.samples.length} samples, ` +
      `avg width: ${(walkable.samples.reduce((s, c) => s + c.width, 0) / walkable.samples.length).toFixed(1)}m`,
  );

  // 8. Regenerate camera path with terrain-following heights
  log.step('Generating terrain-following camera path...');
  const cameraPath = generateCameraPath(
    pca.eigenvectors[0],
    pca.eigenvectors[1],
    boundary,
    floor.height,
    walkable,
  );
  log.step(
    `Path duration: ${cameraPath.duration.toFixed(1)}s, ${cameraPath.waypoints.length} waypoints`,
  );

  // 9. Downsample
  log.step(`Downsampling to ~${(TARGET_POINTS / 1e6).toFixed(1)}M points...`);
  const downsampled = voxelDownsample(
    cloud.positions,
    cloud.colors,
    cloud.count,
    TARGET_POINTS,
    bounds,
  );
  log.step(`Result: ${downsampled.count.toLocaleString()} points`);

  const originalPointCount = cloud.count;

  // Free input arrays to reduce memory pressure before writing
  const releasableCloud = cloud as unknown as {
    positions: Float32Array | null;
    colors: Uint8Array | null;
  };
  releasableCloud.positions = null;
  releasableCloud.colors = null;

  // 10. Write optimized PLY
  const plyPath = join(OUTPUT_DIR, `${def.id}.ply`);
  log.step(`Writing ${plyPath}...`);
  writePLY(
    plyPath,
    downsampled.positions,
    downsampled.colors,
    downsampled.count,
  );

  // 11. Build metadata
  const meta: SceneMeta = {
    sceneId: def.id,
    originalPointCount,
    optimizedPointCount: downsampled.count,
    bounds,
    pca,
    floor,
    boundary,
    cameraPath,
    walkable,
  };

  const metaPath = join(OUTPUT_DIR, `${def.id}.meta.json`);
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  log.step(`Done with ${def.id}`);
  return meta;
}

function main() {
  const log = createLogger('preprocess');
  log.info('7MR Preprocessing Pipeline');
  log.info(`Raw scenes dir: ${RAW_SCENES_DIR}`);
  log.info(`Public scenes dir: ${PUBLIC_SCENES_DIR}`);
  log.info(`Output dir: ${OUTPUT_DIR}`);
  log.info(`Target points per scene: ${TARGET_POINTS.toLocaleString()}`);

  if (!existsSync(PUBLIC_SCENES_DIR)) {
    mkdirSync(PUBLIC_SCENES_DIR, { recursive: true });
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Allow filtering to a single scene via CLI arg: node scripts/preprocess.ts scene_8
  const filterScene = process.argv[2];
  const defs = filterScene
    ? SCENE_DEFS.filter((d) => d.id === filterScene)
    : SCENE_DEFS;

  if (defs.length === 0) {
    console.error(`Unknown scene: ${filterScene}`);
    console.error(`Available: ${SCENE_DEFS.map((d) => d.id).join(', ')}`);
    process.exit(1);
  }

  const allMeta: SceneMeta[] = [];

  for (const def of defs) {
    const meta = processScene(def, log);
    allMeta.push(meta);

    // Suggest GC between scenes to free memory
    if (global.gc) global.gc();
  }

  // Generate tour manifest (only when processing all scenes)
  if (!filterScene) {
    log.info('Stitching tour manifest...');
    const manifest = stitchTour(allMeta);
    const manifestPath = join(PUBLIC_SCENES_DIR, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    log.step(`Wrote ${manifestPath}`);
    log.info(
      `Tour: ${manifest.scenes.length} scenes, ${manifest.totalDuration.toFixed(1)}s total`,
    );
  }

  log.info('Preprocessing complete!');
}

main();
