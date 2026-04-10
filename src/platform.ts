export type AppTarget = 'web' | 'desktop' | 'xr';

const appTargets = new Set<AppTarget>(['web', 'desktop', 'xr']);

function readAppTarget(value: string | undefined): AppTarget {
  if (value && appTargets.has(value as AppTarget)) {
    return value as AppTarget;
  }

  return 'web';
}

function isAbsoluteUrl(path: string): boolean {
  return /^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('/');
}

function resolvePublicUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '');

  if (isAbsoluteUrl(path)) {
    return path;
  }

  return `${import.meta.env.BASE_URL}${cleanPath}`;
}

function resolvePublicDirectory(path: string): string {
  const withSlash = path.endsWith('/') ? path : `${path}/`;

  return resolvePublicUrl(withSlash);
}

export const appPlatform = {
  target: readAppTarget(import.meta.env.VITE_APP_TARGET),
  sceneManifestUrl: resolvePublicUrl(
    import.meta.env.VITE_SCENE_MANIFEST ?? 'scenes/manifest.json',
  ),
  sceneBaseUrl: resolvePublicDirectory(
    import.meta.env.VITE_SCENE_BASE ?? 'scenes/',
  ),
};

export function resolveSceneAssetUrl(assetPath: string): string {
  return `${appPlatform.sceneBaseUrl}${assetPath.replace(/^\/+/, '')}`;
}
