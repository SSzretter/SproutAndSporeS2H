import React from 'react';
import { PlantItem, EquipmentItem } from '../../types/sim';
import { evaluatePlantStageSuitability, DEFAULT_STAGE_REQUIREMENTS, DEFAULT_STAGE_DURATIONS } from '../../utils/plantLifecycle';
import { calculateTrayMicroclimate } from '../../utils/growRacks';
import { PlantVigorCard } from './PlantVigorCard';
import { PlantGeneticsCard } from './PlantGeneticsCard';
import { PlantLifecycleCard } from './PlantLifecycleCard';
import { PlantStageAuditCard } from './PlantStageAuditCard';
import { PlantSoilCard } from './PlantSoilCard';
import { PlantHopsCard } from './PlantHopsCard';
import { PlantPepperCard } from './PlantPepperCard';
import type { ItemSectionProps } from './types';

export const PlantCard: React.FC<ItemSectionProps> = (props) => {
  const { room, currentTent, currentItem } = props;

  return (
    <>
      {currentItem.category === 'plant' && (() => {
        const plant = currentItem as PlantItem;
        const enclosureClimate = currentTent?.climate || room.climate;
        const isSeed = (plant.propagationType || 'seed') === 'seed';
          
        // Get photoperiod hours
        const hostItems = currentTent?.items || room.items;
        const growLight = hostItems.find(i => i.category === 'equipment' && i.type === 'grow_light') as EquipmentItem | undefined;
        let photoperiodHours = 18;
        if (growLight?.schedule?.enabled) {
          const on = growLight.schedule.onHour;
          const off = growLight.schedule.offHour;
          photoperiodHours = off > on ? (off - on) : (24 - on + off);
        } else if (growLight && !growLight.powerOn) {
          photoperiodHours = 0;
        } else if (growLight && growLight.powerOn) {
          photoperiodHours = growLight.schedule?.disabledState === 'on' ? 24 : 0;
        }

        // Check if plant is in a grow rack slot with tray microclimate / humidity dome
        const rack = plant.rackSlot ? hostItems.find(i => i.id === plant.rackSlot!.rackId) as EquipmentItem | undefined : undefined;
        const hasFloorHeatMat = hostItems.some(i => i.category === 'equipment' && i.type === 'heat_mat' && i.powerOn);
        const trayMicro = rack && plant.rackSlot ? calculateTrayMicroclimate({
          rack,
          tierIndex: plant.rackSlot.tier,
          trayIndex: plant.rackSlot.tray,
          ambientClimate: enclosureClimate,
          floorHeatMatActive: hasFloorHeatMat,
          overheadLightPpfd: enclosureClimate.lightPPFD,
          plantStage: plant.stage
        }) : undefined;

        const effectiveClimate = trayMicro ? {
          ...enclosureClimate,
          tempF: trayMicro.tempF,
          rh: trayMicro.rh,
          vpdKpa: trayMicro.vpdKpa,
          lightPPFD: trayMicro.lightPPFD
        } : enclosureClimate;

        // Evaluate live suitability
        const suitability = evaluatePlantStageSuitability(
          plant,
          effectiveClimate,
          plant.rootTempF || 68,
          photoperiodHours,
          trayMicro ? {
            domed: trayMicro.hasDome,
            vented: trayMicro.ventsOpen,
            trappedHeatF: trayMicro.tempF - enclosureClimate.tempF
          } : undefined
        );

        // Expected days for current stage
        let expectedDays = DEFAULT_STAGE_DURATIONS[plant.stage] || 30;
        if (plant.stage === 'germination' && plant.germinationDaysExpected) expectedDays = plant.germinationDaysExpected;
        else if (plant.stage === 'rooting' && plant.rootingDaysExpected) expectedDays = plant.rootingDaysExpected;
        else if (plant.stage === 'seedling' && plant.seedlingDaysExpected) expectedDays = plant.seedlingDaysExpected;
        else if (plant.stage === 'mature_seedling' && plant.matureSeedlingDaysExpected) expectedDays = plant.matureSeedlingDaysExpected;
        else if (plant.stage === 'vegetative' && plant.vegetativeDaysExpected) expectedDays = plant.vegetativeDaysExpected;
        else if (plant.stage === 'flowering' && plant.floweringDaysExpected) expectedDays = plant.floweringDaysExpected;
        else if (plant.stage === 'ripening' && plant.ripeningDaysExpected) expectedDays = plant.ripeningDaysExpected;

        const currentStageDays = plant.currentStageDays || 0;
        const req = plant.stageRequirements?.[plant.stage] || DEFAULT_STAGE_REQUIREMENTS[plant.stage];

        const milestones = [
          {
            id: 'planted',
            label: isSeed ? 'Planted for Germination' : 'Cutting Taken for Rooting',
            date: plant.keyDates?.plantedDate,
            icon: isSeed ? '🌱' : '✂️',
            reached: true
          },
          {
            id: isSeed ? 'sprouted' : 'rooted',
            label: isSeed ? 'Sprouted / Emerged' : 'Roots Struck / Callus',
            date: isSeed ? plant.keyDates?.sproutedDate : plant.keyDates?.rootedDate,
            icon: '🌱',
            reached: Boolean(isSeed ? plant.keyDates?.sproutedDate : plant.keyDates?.rootedDate) || (plant.stage !== 'germination' && plant.stage !== 'rooting')
          },
          {
            id: 'seedling',
            label: 'Early Seedling',
            date: plant.keyDates?.seedlingDate,
            icon: '🌿',
            reached: Boolean(plant.keyDates?.seedlingDate) || (plant.stage !== 'germination' && plant.stage !== 'rooting')
          },
          {
            id: 'mature_seedling',
            label: 'Mature Seedling',
            date: plant.keyDates?.matureSeedlingDate,
            icon: '🪴',
            reached: Boolean(plant.keyDates?.matureSeedlingDate) || ['vegetative', 'flowering', 'ripening', 'ready'].includes(plant.stage)
          },
          {
            id: 'vegetative',
            label: 'Vegetative Canopy',
            date: plant.keyDates?.vegetativeDate,
            icon: '🌿',
            reached: Boolean(plant.keyDates?.vegetativeDate) || ['flowering', 'ripening', 'ready'].includes(plant.stage)
          },
          {
            id: 'flowering',
            label: 'Flowering Bloom',
            date: plant.keyDates?.floweringDate,
            icon: '🌸',
            reached: Boolean(plant.keyDates?.floweringDate) || ['ripening', 'ready'].includes(plant.stage)
          },
          {
            id: 'ripening',
            label: 'Ripening / Trichomes',
            date: plant.keyDates?.ripeningDate,
            icon: '✨',
            reached: Boolean(plant.keyDates?.ripeningDate) || plant.stage === 'ready'
          },
          {
            id: 'ready',
            label: 'Ready for Harvest',
            date: plant.keyDates?.readyDate,
            icon: '🏆',
            reached: Boolean(plant.keyDates?.readyDate) || plant.stage === 'ready'
          }
        ];

        return (
          <div className="space-y-4">
            <PlantVigorCard {...props} plant={plant} isSeed={isSeed} />

            <PlantGeneticsCard {...props} plant={plant} isSeed={isSeed} currentStageDays={currentStageDays} />

            <PlantLifecycleCard {...props} plant={plant} isSeed={isSeed} suitability={suitability} expectedDays={expectedDays} currentStageDays={currentStageDays} milestones={milestones} />

            <PlantStageAuditCard
              {...props}
              plant={plant}
              enclosureClimate={effectiveClimate}
              photoperiodHours={photoperiodHours}
              suitability={suitability}
              req={req}
              trayMicro={trayMicro}
              rack={rack}
            />

            <PlantSoilCard {...props} plant={plant} />

            <PlantHopsCard {...props} plant={plant} />

            <PlantPepperCard {...props} plant={plant} />
          </div>
        );
      })()}
    </>
  );
};
