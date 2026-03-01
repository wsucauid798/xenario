import { useState } from 'react';
import { LoadScreen } from './components/LoadScreen';
import { ExperiencePlayer } from './components/ExperiencePlayer';
import type { PointCloudAsset } from './modules/PointCloudAsset';
import type { PathConfig } from './modules/RailCamera';

interface LoadedScene {
  asset: PointCloudAsset;
  pathConfig?: PathConfig;
}

export default function App() {
  const [scene, setScene] = useState<LoadedScene | null>(null);

  const onLoaded = (asset: PointCloudAsset, pathConfig?: PathConfig) => {
    setScene({ asset, pathConfig });
  };

  const onUnload = () => {
    setScene(null);
  };

  if (scene) {
    return (
      <div className="w-full h-full">
        <ExperiencePlayer
          asset={scene.asset}
          pathConfig={scene.pathConfig}
          onUnload={onUnload}
        />
      </div>
    );
  }

  return <LoadScreen onLoaded={onLoaded} />;
}
