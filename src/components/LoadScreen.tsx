import { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileJson, AlertCircle, Loader2 } from 'lucide-react';
import { loadPLY, downsample, suggestDownsampleFactor } from '../modules/PointCloudAsset';
import type { PointCloudAsset } from '../modules/PointCloudAsset';
import type { PathConfig } from '../modules/RailCamera';

interface Props {
  onLoaded: (asset: PointCloudAsset, pathConfig?: PathConfig) => void;
}

const MOBILE_TARGET = 500_000;
const DESKTOP_TARGET = 4_000_000;

function isMobileish(): boolean {
  return (navigator.hardwareConcurrency ?? 4) <= 4 || window.innerWidth < 768;
}

export function LoadScreen({ onLoaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plyName, setPlyName] = useState<string | null>(null);
  const [pathName, setPathName] = useState<string | null>(null);
  const [pendingPly, setPendingPly] = useState<File | null>(null);
  const [pendingPath, setPendingPath] = useState<PathConfig | null>(null);
  const plyInputRef = useRef<HTMLInputElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const ply = arr.find(f => f.name.toLowerCase().endsWith('.ply'));
    const json = arr.find(f => f.name.toLowerCase().endsWith('.json'));

    if (ply) setPendingPly(ply), setPlyName(ply.name);
    if (json) {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const cfg = JSON.parse(e.target!.result as string) as PathConfig;
          setPendingPath(cfg);
          setPathName(json.name);
        } catch {
          setError('Invalid path.json');
        }
      };
      reader.readAsText(json);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    setError(null);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const startExperience = async () => {
    if (!pendingPly) { setError('Drop a .ply file to get started.'); return; }
    setLoading(true);
    setError(null);
    try {
      let asset = await loadPLY(pendingPly);
      const target = isMobileish() ? MOBILE_TARGET : DESKTOP_TARGET;
      const factor = suggestDownsampleFactor(asset.meta.pointCount, target);
      if (factor > 1) {
        const reduced = downsample(asset.geometry, factor);
        asset = { ...asset, geometry: reduced, meta: { ...asset.meta, pointCount: reduced.attributes.position.count } };
      }
      onLoaded(asset, pendingPath ?? undefined);
    } catch (e) {
      setError(`Failed to load: ${(e as Error).message}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-lg flex flex-col gap-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-white text-3xl font-light tracking-widest uppercase mb-2">Xenario</h1>
          <p className="text-white/40 text-sm">Point cloud experience player</p>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => plyInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer
            transition-colors duration-200
            ${dragging
              ? 'border-white/60 bg-white/5'
              : 'border-white/20 hover:border-white/40 hover:bg-white/5'
            }
          `}
        >
          <UploadCloud size={40} className={`transition-colors ${dragging ? 'text-white' : 'text-white/40'}`} />

          {plyName ? (
            <div className="text-center">
              <p className="text-white text-sm font-medium">{plyName}</p>
              {pathName && (
                <p className="text-white/50 text-xs mt-1 flex items-center justify-center gap-1">
                  <FileJson size={12} /> {pathName}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-white/70 text-sm">Drop a <span className="text-white font-medium">.ply</span> file here</p>
              <p className="text-white/30 text-xs mt-1">Optionally include a <span className="text-white/50">path.json</span> to define the camera route</p>
            </div>
          )}
        </div>

        {/* Path JSON slot (separate, optional) */}
        {plyName && !pathName && (
          <button
            onClick={() => pathInputRef.current?.click()}
            className="flex items-center justify-center gap-2 text-white/40 hover:text-white/70 text-xs transition-colors py-2"
          >
            <FileJson size={14} />
            Add optional path.json (or auto-generate from scene)
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Start button */}
        <button
          onClick={startExperience}
          disabled={!pendingPly || loading}
          className={`
            w-full py-3.5 rounded-xl text-sm font-medium tracking-wider uppercase transition-all
            ${pendingPly && !loading
              ? 'bg-white text-black hover:bg-white/90 active:scale-98'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
            }
          `}
        >
          {loading
            ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</span>
            : 'Start Experience'
          }
        </button>

        {/* Hidden inputs */}
        <input
          ref={plyInputRef}
          type="file"
          accept=".ply"
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
        <input
          ref={pathInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={e => {
            if (!e.target.files?.[0]) return;
            const reader = new FileReader();
            reader.onload = ev => {
              try {
                setPendingPath(JSON.parse(ev.target!.result as string));
                setPathName(e.target.files![0].name);
              } catch { setError('Invalid path.json'); }
            };
            reader.readAsText(e.target.files[0]);
          }}
        />
      </div>
    </div>
  );
}
