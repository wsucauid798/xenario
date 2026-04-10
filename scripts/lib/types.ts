/** Raw point cloud data — no Three.js dependency */
export interface PointCloud {
  positions: Float32Array; // interleaved x,y,z
  colors: Uint8Array; // interleaved r,g,b
  count: number;
}

/** 3D vector as plain tuple */
export type Vec3 = [number, number, number];

/** Axis-aligned bounding box */
export interface AABB {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  size: Vec3;
}

/** Result of PCA analysis */
export interface PCAResult {
  eigenvalues: Vec3; // sorted descending
  eigenvectors: [Vec3, Vec3, Vec3]; // corresponding to eigenvalues
  mean: Vec3;
}

/** Floor detection result */
export interface FloorPlane {
  normal: Vec3; // unit normal (pointing up)
  distance: number; // signed distance from origin
  height: number; // floor y-coordinate in world space
  inlierRatio: number;
  confidence: number; // 0-1, derived from inlier quality
}

/** Boundary endpoints along principal axis */
export interface BoundaryInfo {
  startPoint: Vec3;
  endPoint: Vec3;
  startDensity: number;
  endDensity: number;
  principalLength: number;
}

/** Camera path definition */
export interface CameraPath {
  duration: number;
  waypoints: Vec3[];
}

/** Sampled corridor cross-section along the guide path */
export interface CorridorSample {
  t: number; // 0-1 along path
  center: Vec3; // center of corridor at this sample
  width: number; // walkable width (secondary axis extent)
  floorHeight: number; // local floor height at this sample
}

/** Walkable area definition */
export interface WalkableCorridor {
  samples: CorridorSample[];
  minBound: Vec3; // overall walkable AABB min (with inset)
  maxBound: Vec3; // overall walkable AABB max (with inset)
}

/** Per-scene metadata written to .meta.json */
export interface SceneMeta {
  sceneId: string;
  originalPointCount: number;
  optimizedPointCount: number;
  bounds: AABB;
  pca: PCAResult;
  floor: FloorPlane;
  boundary: BoundaryInfo;
  cameraPath: CameraPath;
  walkable: WalkableCorridor;
}

/** Scene entry in tour manifest */
export interface TourScene {
  sceneId: string;
  plyFile: string;
  metaFile: string;
  entryPoint: Vec3;
  exitPoint: Vec3;
}

/** Tour manifest — top-level output */
export interface TourManifest {
  version: 1;
  scenes: TourScene[];
  totalDuration: number;
}

/** PLY format discriminator */
export type PLYFormat = 'sitescape' | 'scanner';

/** Scene definition for pipeline input */
export interface SceneDefinition {
  id: string;
  files: string[]; // empty = auto-discover all .ply in scene dir
  format: PLYFormat;
}
