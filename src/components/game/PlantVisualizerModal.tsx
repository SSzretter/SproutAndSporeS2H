import React, { useState, useEffect, useRef } from 'react';
import { X, Play, RotateCcw, Droplets, Sparkles, Scissors, Award, Sun, Thermometer, Wind, Check, Calendar, Activity, Sliders } from 'lucide-react';
import { PlantItem, MushroomItem, PlantStage, Climate } from '../../types/sim';
import { drawPlant, drawMushroom } from './PlantSprites';
import { evaluatePlantStageSuitability, DEFAULT_STAGE_REQUIREMENTS, formatSimDateTime } from '../../utils/plantLifecycle';
import { soundEffects } from './AudioEffects';

interface PlantVisualizerModalProps {
  item: PlantItem | MushroomItem;
  enclosureClimate?: Climate;
  isOpen: boolean;
  onClose: () => void;
  onWater: (item: PlantItem | MushroomItem) => void;
  onFeed: (item: PlantItem) => void;
  onPrune: (item: PlantItem) => void;
  onHarvest: (item: PlantItem | MushroomItem) => void;
  onOpenFullInspector?: () => void;
}

export const PlantVisualizerModal: React.FC<PlantVisualizerModalProps> = ({
  item,
  enclosureClimate,
  isOpen,
  onClose,
  onWater,
  onFeed,
  onPrune,
  onHarvest,
  onOpenFullInspector
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [timelapseMode, setTimelapseMode] = useState(false);
  const [timelapseStage, setTimelapseStage] = useState<PlantStage>('germination');
  const [timelapseProgress, setTimelapseProgress] = useState(0);

  const isPlant = item.category === 'plant';
  const plant = isPlant ? (item as PlantItem) : null;
  const shroom = !isPlant ? (item as MushroomItem) : null;

  // Stages array for timelapse
  const stages: PlantStage[] = isPlant && plant?.propagationType === 'cutting'
    ? ['rooting', 'seedling', 'mature_seedling', 'vegetative', 'flowering', 'ripening', 'ready']
    : ['germination', 'seedling', 'mature_seedling', 'vegetative', 'flowering', 'ripening', 'ready'];

  // Timelapse loop
  useEffect(() => {
    if (!timelapseMode) return;
    let currentStageIndex = 0;
    let progress = 0;

    const interval = setInterval(() => {
      progress += 4;
      if (progress >= 100) {
        progress = 0;
        currentStageIndex++;
        if (currentStageIndex >= stages.length) {
          setTimelapseMode(false);
          clearInterval(interval);
          return;
        }
      }
      setTimelapseStage(stages[currentStageIndex]);
      setTimelapseProgress(progress);
    }, 60);

    return () => clearInterval(interval);
  }, [timelapseMode]);

  // Canvas render loop
  useEffect(() => {
    if (!isOpen) return;
    let animId: number;

    const render = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background ambient grow light glow
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.72;

      // Floor tile grid
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Radial grow light glow
      const grad = ctx.createRadialGradient(cx, cy - 80, 20, cx, cy - 80, 220);
      grad.addColorStop(0, 'rgba(254, 240, 138, 0.15)');
      grad.addColorStop(1, 'rgba(24, 24, 27, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Pedestal platform
      ctx.beginPath();
      ctx.ellipse(cx, cy + 18, 90, 24, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#27272a';
      ctx.fill();
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (isPlant && plant) {
        const renderItem: PlantItem = timelapseMode
          ? {
              ...plant,
              stage: timelapseStage,
              stageProgress: timelapseProgress,
              soilMoisture: 75,
              health: 100
            }
          : plant;

        drawPlant(renderItem, {
          ctx,
          x: cx,
          y: cy + 10,
          scale: 2.8,
          time,
          highlighted: true
        });
      } else if (shroom) {
        drawMushroom(shroom, {
          ctx,
          x: cx,
          y: cy + 10,
          scale: 3.0,
          time,
          highlighted: true
        });
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, item, timelapseMode, timelapseStage, timelapseProgress]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: 2D Interactive Canvas Viewport */}
        <div className="relative flex-1 min-h-[380px] bg-zinc-900/50 flex flex-col items-center justify-center p-4 border-b md:border-b-0 md:border-r border-zinc-800">
          <canvas
            ref={canvasRef}
            width={480}
            height={440}
            className="w-full h-auto max-h-[420px] rounded-2xl"
          />

          {/* Timelapse Control Bar */}
          {isPlant && (
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between px-3.5 py-2 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-2xl text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    setTimelapseMode(!timelapseMode);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                    timelapseMode
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-950/40'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {timelapseMode ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{timelapseMode ? 'Stop Timelapse' : 'Watch Lifecycle Growth'}</span>
                </button>
              </div>

              {timelapseMode ? (
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-zinc-400">Stage:</span>
                  <span className="text-amber-300 font-bold uppercase">{timelapseStage.replace('_', ' ')}</span>
                  <span className="text-zinc-500">({timelapseProgress}%)</span>
                </div>
              ) : (
                <span className="text-[11px] text-zinc-400 font-mono">
                  Current: <strong className="text-emerald-400 uppercase">{item.stage.replace('_', ' ')}</strong> ({item.stageProgress.toFixed(0)}%)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Telemetry, Milestones & Direct Actions */}
        <div className="w-full md:w-80 p-5 flex flex-col justify-between space-y-4 bg-zinc-950 text-zinc-200">
          <div>
            <div className="border-b border-zinc-800 pb-3 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block mb-0.5">
                {isPlant ? (plant?.propagationType === 'cutting' ? '✂️ Clone / Cutting' : '🌱 Seedling Lineage') : '🍄 Fungal Colony'}
              </span>
              <h3 className="text-lg font-bold text-zinc-100">{item.name}</h3>
              <p className="text-xs text-zinc-400">{item.species} · {item.strainName}</p>
            </div>

            {/* Stage & Progress */}
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Growth Stage Progress</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {item.stage.replace('_', ' ').toUpperCase()} ({item.stageProgress.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                  style={{ width: `${item.stageProgress}%` }}
                />
              </div>
            </div>

            {/* Telemetry Stat Cards */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-850">
                <span className="text-[10px] text-zinc-500 block">Health</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{item.health}%</span>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-850">
                <span className="text-[10px] text-zinc-500 block">
                  {isPlant ? 'Soil Moisture' : 'Substrate Hydration'}
                </span>
                <span className="font-mono font-bold text-cyan-400 text-sm">
                  {isPlant ? `${plant?.soilMoisture.toFixed(0)}%` : `${shroom?.substrateMoisture.toFixed(0)}%`}
                </span>
              </div>

              {isPlant && plant && (
                <>
                  <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">Substrate pH</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {(plant.soilPh || 6.4).toFixed(2)} pH
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">EC / Nutrients</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {Math.round(plant.ecTdsPpm || 850)} PPM
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Container, Medium & Hops Brewing Info */}
            {isPlant && plant && (
              <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-850 space-y-1.5 text-[11px] mb-3">
                <div className="flex justify-between text-zinc-400">
                  <span>Container &amp; Medium:</span>
                  <span className="font-medium text-zinc-200 capitalize truncate max-w-[180px]">
                    {plant.containerVolumeGallons || 5}g {(plant.containerType || 'fabric_pot').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Substrate Biology:</span>
                  <span className="font-medium text-teal-400 capitalize">
                    {(plant.growingMedium || 'living_organic_soil').replace(/_/g, ' ')} ({plant.microbialHealth || 85}%)
                  </span>
                </div>
                {plant.species === 'Hops' && (
                  <div className="pt-1.5 border-t border-zinc-800 flex justify-between text-amber-300 font-medium">
                    <span>🍺 Alpha Acids:</span>
                    <span className="font-mono font-bold">{(plant.alphaAcidsPct || 7.0).toFixed(1)}% AA · {(plant.heightInches / 12).toFixed(1)}′ Bine</span>
                  </div>
                )}
              </div>
            )}

            {/* Tracked Date Milestones preview */}
            {isPlant && plant?.keyDates && (
              <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-zinc-300 font-semibold mb-1">
                  <Calendar className="w-3.5 h-3.5 text-teal-400" />
                  <span>Key Lifecycle Dates</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Planted / Taken:</span>
                  <span className="font-mono text-zinc-200">{formatSimDateTime(plant.keyDates.plantedDate)}</span>
                </div>
                {plant.keyDates.sproutedDate && (
                  <div className="flex justify-between text-zinc-400">
                    <span>Sprouted:</span>
                    <span className="font-mono text-emerald-400">{formatSimDateTime(plant.keyDates.sproutedDate)}</span>
                  </div>
                )}
                {plant.keyDates.floweringDate && (
                  <div className="flex justify-between text-zinc-400">
                    <span>Bloom Flowered:</span>
                    <span className="font-mono text-amber-400">{formatSimDateTime(plant.keyDates.floweringDate)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions in Modal */}
          <div className="space-y-2 pt-2 border-t border-zinc-850">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  soundEffects.playWater();
                  onWater(item);
                }}
                className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-950/40"
              >
                <Droplets className="w-3.5 h-3.5" />
                <span>{isPlant ? 'Water Pot' : 'Mist Substrate'}</span>
              </button>

              {isPlant && plant && (
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    onFeed(plant);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950/40"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Feed Nutrients</span>
                </button>
              )}
            </div>

            {isPlant && plant && (
              <button
                onClick={() => {
                  soundEffects.playSnip();
                  onPrune(plant);
                }}
                className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border border-zinc-750"
              >
                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                <span>Prune / Top Canopy (+Branching)</span>
              </button>
            )}

            <button
              onClick={() => {
                soundEffects.playHarvest();
                onHarvest(item);
                onClose();
              }}
              className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md ${
                item.stage === 'ready' || item.stage === 'ripening' || item.stage === 'mature'
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-950/50 animate-pulse'
                  : 'bg-zinc-800 hover:bg-amber-950/60 hover:text-amber-300 text-zinc-400 border border-zinc-700'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Harvest Crop ({item.yieldPotentialGrams.toFixed(0)}g)</span>
            </button>

            {onOpenFullInspector && (
              <button
                type="button"
                onClick={() => {
                  soundEffects.playClick();
                  onOpenFullInspector();
                }}
                className="w-full py-2 px-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>⚙️ Full Properties &amp; Stage Editor</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
