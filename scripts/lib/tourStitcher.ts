import type { SceneMeta, TourManifest, TourScene } from './types.ts';
import { dist } from './vec3.ts';

/**
 * Chain scenes into a tour by connecting each scene's exit to the next
 * scene's nearest boundary endpoint.
 */
export function stitchTour(scenes: SceneMeta[]): TourManifest {
  const tourScenes: TourScene[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const { boundary } = scene;

    let entryPoint = boundary.startPoint;
    let exitPoint = boundary.endPoint;

    if (i > 0) {
      const prevExit = tourScenes[i - 1].exitPoint;
      const distToStart = dist(prevExit, boundary.startPoint);
      const distToEnd = dist(prevExit, boundary.endPoint);

      if (distToEnd < distToStart) {
        // Reverse: enter at the end, exit at the start
        entryPoint = boundary.endPoint;
        exitPoint = boundary.startPoint;
      }
    }

    tourScenes.push({
      sceneId: scene.sceneId,
      plyFile: `optimized/${scene.sceneId}.ply`,
      metaFile: `optimized/${scene.sceneId}.meta.json`,
      entryPoint,
      exitPoint,
    });
  }

  const totalDuration = scenes.reduce(
    (sum, s) => sum + s.cameraPath.duration,
    0,
  );

  return { version: 1, scenes: tourScenes, totalDuration };
}
