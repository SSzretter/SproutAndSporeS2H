import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  Layers, 
  Sparkles, 
  Info, 
  Eye, 
  Compass, 
  ChevronRight,
  Maximize2,
  Calendar,
  Award,
  Sprout,
  Flower2,
  Check
} from 'lucide-react';
import { PlantItem, MushroomItem, PlantStage, PlantSpecies } from '../../types/sim';
import { PlantModel } from './PlantModel';
import { MushroomModel } from './MushroomModel';
import { 
  getPlantStageStartSize, 
  getContainerSizeFactor,
  STAGE_END_SIZES 
} from '../../utils/plantLifecycle';
import { soundEffects } from '../game/AudioEffects';

interface CropGrowth3DViewerProps {
  crop: PlantItem | MushroomItem;
  isOpen: boolean;
  onClose: () => void;
  onApplyStage?: (stage: PlantStage | MushroomItem['stage'], progress: number) => void;
}

const PLANT_STAGE_DESCRIPTIONS: Record<PlantStage, string> = {
  germination: 'Radicle cracks taproot downward while hypocotyl loop pushes upward through the substrate.',
  rooting: 'Adventitious root primordia strike into aerated clone medium under high humidity.',
  seedling: 'First pair of true serrated leaves unfold above embryonic cotyledon leaves.',
  mature_seedling: 'Root network anchors deeply; internodal spacing establishes main stem architecture.',
  vegetative: 'Rapid foliage expansion and branch extension fueled by intensive photosynthesis.',
  flowering: 'Pistillate calyxes and flowers swell, filling internodes with resin glands and floral clusters.',
  ripening: 'Trichome heads transition from clear to milky/amber; secondary terpenes and alpha acids concentrate.',
  ready: 'Harvest peak: floral calyxes swollen, aromatic potency maxed, ready for fresh curing.'
};

const MUSHROOM_STAGE_DESCRIPTIONS: Record<string, string> = {
  colonizing: 'White hyphal mycelium threads rapidly anastomose and consolidate grain and bulk substrate.',
  pinning: 'Hyphal knots aggregate on substrate micro-climate surface, forming dense primordia pinheads.',
  fruiting: 'Pins expand rapidly into stipes and pilei caps, metabolizing substrate moisture.',
  mature: 'Caps expand outward; gills/teeth produce viable spore drops as veil stretches.',
  ready: 'Full flush maturity achieved: optimal fresh weight, firm caps, prime for harvesting.'
};

export const CropGrowth3DViewer: React.FC<CropGrowth3DViewerProps> = ({
  crop,
  isOpen,
  onClose,
  onApplyStage
}) => {
  const isPlant = crop.category === 'plant';
  const plant = isPlant ? (crop as PlantItem) : null;
  const shroom = !isPlant ? (crop as MushroomItem) : null;

  // Stages array
  const stages: (PlantStage | MushroomItem['stage'])[] = useMemo(() => {
    if (isPlant) {
      return plant?.propagationType === 'cutting'
        ? ['rooting', 'seedling', 'mature_seedling', 'vegetative', 'flowering', 'ripening', 'ready']
        : ['germination', 'seedling', 'mature_seedling', 'vegetative', 'flowering', 'ripening', 'ready'];
    }
    return ['colonizing', 'pinning', 'fruiting', 'mature', 'ready'];
  }, [isPlant, plant?.propagationType]);

  // Initial stage index matching the crop's current stage
  const initialIndex = useMemo(() => {
    const idx = stages.indexOf(crop.stage as any);
    return idx !== -1 ? idx : 0;
  }, [crop.stage, stages]);

  const [currentStageIndex, setCurrentStageIndex] = useState<number>(initialIndex);
  const [stageProgress, setStageProgress] = useState<number>(crop.stageProgress || 0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [cameraHintVisible, setCameraHintVisible] = useState<boolean>(true);

  // Auto-hide camera hint after 4 seconds
  useEffect(() => {
    const t = setTimeout(() => setCameraHintVisible(false), 4500);
    return () => clearTimeout(t);
  }, []);

  // Timelapse progression loop
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const interval = setInterval(() => {
      setStageProgress(prev => {
        const next = prev + 1.2 * playbackSpeed;
        if (next >= 100) {
          setCurrentStageIndex(cIdx => {
            if (cIdx < stages.length - 1) {
              return cIdx + 1;
            } else {
              // Loop back to start
              return 0;
            }
          });
          return 0;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen, isPlaying, playbackSpeed, stages.length]);

  if (!isOpen) return null;

  const currentStage = stages[currentStageIndex];

  // Calculate live dynamic physical dimensions for simulated plant
  const simulatedPlant: PlantItem | null = isPlant && plant ? (() => {
    const pStage = currentStage as PlantStage;
    const startSize = getPlantStageStartSize(plant.species, pStage, plant.propagationType);
    const table = STAGE_END_SIZES[plant.species] || STAGE_END_SIZES.Cannabis;
    const endSize = table[pStage] || startSize;
    const cFactor = getContainerSizeFactor(plant.containerVolumeGallons || 5);
    const scaledEndH = (pStage === 'vegetative' || pStage === 'flowering' || pStage === 'ripening' || pStage === 'ready')
      ? endSize.heightInches * cFactor
      : endSize.heightInches;
    const scaledEndW = (pStage === 'vegetative' || pStage === 'flowering' || pStage === 'ripening' || pStage === 'ready')
      ? endSize.canopyWidthInches * cFactor
      : endSize.canopyWidthInches;

    const t = Math.max(0, Math.min(1, stageProgress / 100));
    const h = startSize.heightInches + (scaledEndH - startSize.heightInches) * t;
    const w = startSize.canopyWidthInches + (scaledEndW - startSize.canopyWidthInches) * t;

    return {
      ...plant,
      stage: pStage,
      stageProgress: Math.round(stageProgress),
      heightInches: Math.max(0.4, h),
      canopyWidthInches: Math.max(0.4, w),
      health: 100
    };
  })() : null;

  // Calculate live simulated mushroom
  const simulatedShroom: MushroomItem | null = !isPlant && shroom ? {
    ...shroom,
    stage: currentStage as MushroomItem['stage'],
    stageProgress: Math.round(stageProgress),
    myceliumColonization: currentStage === 'colonizing' ? Math.max(15, Math.round(stageProgress)) : 100,
    health: 100
  } : null;

  // Cumulative overall lifecycle %
  const totalLifecyclePct = Math.round(
    ((currentStageIndex + stageProgress / 100) / stages.length) * 100
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl h-[92vh] max-h-[860px] bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-950/90 border-b border-zinc-850 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              isPlant ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {isPlant ? <Flower2 className="w-5 h-5" /> : <Sprout className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  {crop.name}
                  <span className="text-[11px] font-normal text-zinc-400">
                    ({crop.species} · {crop.strainName})
                  </span>
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  isPlant ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}>
                  3D Lifecycle Growth Model
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                True 3D procedural simulation matching the in-game environment. Rotate 360° to inspect foliage, internodes, and flowering development.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onApplyStage && (
              <button
                type="button"
                onClick={() => {
                  soundEffects.playClick();
                  onApplyStage(currentStage as any, stageProgress);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-950/70 hover:bg-teal-900 text-teal-200 border border-teal-800/60 text-xs font-semibold transition-colors"
                title="Apply this simulated stage to the crop in your facility"
              >
                <Check className="w-3.5 h-3.5 text-teal-400" />
                <span>Apply Stage ({currentStage.replace('_', ' ')})</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-700 transition-colors shadow-sm"
            >
              <span>Back to Inspector</span>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3D Viewport with Orbit Controls */}
        <div className="relative flex-1 w-full bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 overflow-hidden">
          <Canvas
            dpr={[1, 2]}
            camera={{ 
              fov: 42, 
              near: 0.1, 
              far: 100, 
              position: [0, isPlant && plant?.species === 'Hops' ? 3.5 : 1.4, isPlant && plant?.species === 'Hops' ? 6.5 : 3.2] 
            }}
          >
            {/* Studio Environment Lighting */}
            <ambientLight intensity={0.7} />
            <directionalLight position={[4, 8, 4]} intensity={1.5} castShadow />
            <directionalLight position={[-4, 5, -3]} intensity={0.6} color="#93c5fd" />
            <hemisphereLight args={['#ffffff', '#1e293b', 0.8]} />

            {/* Orbit Controls (full 360 rotation & zoom) */}
            <OrbitControls
              makeDefault
              minDistance={0.8}
              maxDistance={12}
              maxPolarAngle={Math.PI * 0.49}
              minPolarAngle={0.05}
              target={[0, isPlant && plant?.species === 'Hops' ? 1.5 : 0.4, 0]}
            />

            {/* Pedestal / Ground Base */}
            <group position={[0, -0.01, 0]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[2.8, 48]} />
                <meshStandardMaterial color="#18181b" roughness={0.9} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
                <ringGeometry args={[2.7, 2.76, 48]} />
                <meshBasicMaterial color={isPlant ? '#059669' : '#d97706'} transparent opacity={0.35} />
              </mesh>
            </group>

            {/* 3D Crop Model (Exact same model as 3D game mode) */}
            {isPlant && simulatedPlant && (
              <PlantModel plant={simulatedPlant} />
            )}
            {!isPlant && simulatedShroom && (
              <MushroomModel shroom={simulatedShroom} />
            )}
          </Canvas>

          {/* 3D Viewport Overlay Badges */}
          <div className="absolute top-4 left-4 z-10 space-y-1.5 pointer-events-none">
            <div className="flex items-center gap-2 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-xs">
              <span className="text-zinc-400 font-medium">Stage:</span>
              <span className="font-mono font-bold text-emerald-400 uppercase tracking-wide">
                {currentStage.replace('_', ' ')}
              </span>
              <span className="text-zinc-500 font-mono">({stageProgress.toFixed(0)}%)</span>
            </div>

            {isPlant && simulatedPlant && (
              <div className="flex items-center gap-3 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-[11px] font-mono">
                <div>
                  <span className="text-zinc-500">Height: </span>
                  <span className="font-bold text-zinc-200">
                    {simulatedPlant.heightInches < 12 
                      ? `${simulatedPlant.heightInches.toFixed(1)}″`
                      : `${(simulatedPlant.heightInches / 12).toFixed(1)}′ (${simulatedPlant.heightInches.toFixed(0)}″)`}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Canopy: </span>
                  <span className="font-bold text-zinc-200">{simulatedPlant.canopyWidthInches.toFixed(1)}″</span>
                </div>
                <div>
                  <span className="text-zinc-500">Container: </span>
                  <span className="font-bold text-teal-400 capitalize">
                    {simulatedPlant.containerVolumeGallons}g {simulatedPlant.containerType?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            )}

            {!isPlant && simulatedShroom && (
              <div className="flex items-center gap-3 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-[11px] font-mono">
                <div>
                  <span className="text-zinc-500">Mycelium: </span>
                  <span className="font-bold text-amber-400">{simulatedShroom.myceliumColonization}%</span>
                </div>
                <div>
                  <span className="text-zinc-500">Vessel: </span>
                  <span className="font-bold text-zinc-200 capitalize">{simulatedShroom.containerType}</span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Camera Hint */}
          {cameraHintVisible && (
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-zinc-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-[11px] text-zinc-300 pointer-events-none animate-in fade-in duration-300">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>Left-drag to rotate in 360° · Scroll to zoom</span>
            </div>
          )}

          {/* Biological Stage Narrative Banner */}
          <div className="absolute bottom-3 left-4 right-4 z-10 bg-zinc-950/85 backdrop-blur-md px-4 py-2 rounded-xl border border-zinc-850 flex items-center justify-between text-xs pointer-events-none">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-zinc-300 text-[11px]">
                {isPlant 
                  ? PLANT_STAGE_DESCRIPTIONS[currentStage as PlantStage] 
                  : MUSHROOM_STAGE_DESCRIPTIONS[currentStage] || 'Mycelium growth progression.'}
              </p>
            </div>
            <span className="font-mono text-[11px] text-emerald-400 font-bold shrink-0 ml-3">
              {totalLifecyclePct}% Overall Lifecycle
            </span>
          </div>
        </div>

        {/* Bottom Playback & Stage Controls Dock */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-850 space-y-3 z-20 shrink-0">
          {/* Stage Jumper Navigation Pills */}
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
            {stages.map((st, idx) => {
              const isSelected = currentStage === st;
              const isPast = idx < currentStageIndex;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    soundEffects.playClick();
                    setCurrentStageIndex(idx);
                    setStageProgress(0);
                  }}
                  className={`flex-1 min-w-[90px] py-2 px-2 rounded-xl border text-center transition-all ${
                    isSelected
                      ? isPlant
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/50 shadow-md shadow-emerald-950/40'
                        : 'bg-amber-950 border-amber-500 text-amber-200 ring-1 ring-amber-500/50 shadow-md shadow-amber-950/40'
                      : isPast
                        ? 'bg-zinc-900/90 border-zinc-750 text-zinc-300'
                        : 'bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">Stage {idx + 1}</span>
                  <span className="text-[11px] font-semibold block capitalize truncate">{st.replace('_', ' ')}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Scrubber & Transport Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Play, Reset, and Speed buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEffects.playClick();
                  setIsPlaying(!isPlaying);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                  isPlaying
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-950/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pause Timelapse' : 'Resume Growth'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEffects.playClick();
                  setCurrentStageIndex(0);
                  setStageProgress(0);
                }}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                title="Reset to Day 0 Sprout"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Speed Buttons */}
              <div className="flex items-center bg-zinc-900 rounded-xl p-0.5 border border-zinc-800 text-[11px] font-mono">
                {[0.5, 1, 2, 4].map(spd => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-1 rounded-lg transition-all ${
                      playbackSpeed === spd
                        ? 'bg-zinc-750 text-white font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Continuous Stage Progress Scrub Slider */}
            <div className="flex-1 min-w-[200px] flex items-center gap-3">
              <span className="text-[11px] text-zinc-400 font-mono shrink-0">Stage Progress:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={stageProgress}
                onChange={e => {
                  setIsPlaying(false);
                  setStageProgress(Number(e.target.value));
                }}
                className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
              />
              <span className="font-mono text-xs font-bold text-emerald-400 w-10 text-right">
                {stageProgress.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
