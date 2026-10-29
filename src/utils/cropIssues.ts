import { Climate, Item, MushroomItem, PlantItem } from '../types/sim';
import { DEFAULT_STAGE_REQUIREMENTS, evaluatePlantStageSuitability } from './plantLifecycle';
import { getFeedingReservoir, isNutrientReservoirEmpty, LOW_ROOT_OXYGEN_PCT, RESERVOIR_FED_SYSTEMS } from './nutrientReservoirs';

/**
 * Problems a grower should notice on a plant or mushroom, most severe first. Used for the 3D
 * view's issue badges and tooltips. Plants are judged by the same stage-suitability evaluation the
 * inspector shows (and that sets growth speed), so every non-ideal factor there appears here too.
 * Light *level* is only judged while the lights are on (it reads as insufficient every night);
 * the photoperiod comes from the light schedule, so it's valid at any hour.
 */

export type CropIssueSeverity = 'critical' | 'warning';

export interface CropIssue {
  severity: CropIssueSeverity;
  label: string; // with readings & targets, for tooltips ("Too cold (64.0°F, min 72)")
}

/** Compact form for a badge: the label without its readings ("Too cold"). */
export function issueBadgeText(issue: CropIssue): string {
  return issue.label.split(' (')[0];
}

// Temperature / humidity this far outside a stage's limits is critical rather than a warning
const TEMP_CRITICAL_F = 6;
const RH_CRITICAL = 15;
// Below this canopy PPFD the grow lights are off (night / lights-out)
const LIGHTS_ON_PPFD = 40;

/**
 * Hours of light per day in a container, from its grow light the same way the simulation reads it:
 * the schedule if one is set, 24h if left on, 0 if switched off. Outdoors (or no light at all) the
 * plants get natural daylight.
 */
export function getPhotoperiodHours(containerItems: Item[], outdoor: boolean): number {
  const light = containerItems.find(i => i.category === 'equipment' && i.type === 'grow_light');
  if (!light || light.category !== 'equipment') return outdoor ? 14 : 18;
  if (light.schedule?.enabled) {
    const { onHour, offHour } = light.schedule;
    return offHour > onHour ? offHour - onHour : 24 - onHour + offHour;
  }
  if (!light.powerOn) return 0;
  return light.schedule?.disabledState === 'on' ? 24 : 0;
}

function plantIssues(plant: PlantItem, climate: Climate, photoperiodHours: number): CropIssue[] {
  const issues: CropIssue[] = [];
  if (plant.isHarvested) return issues;

  if (plant.traits?.germinationOutcome === 'failed') {
    return [{ severity: 'critical', label: plant.stage === 'rooting' ? 'Cutting failed to root' : 'Seed failed to sprout' }];
  }

  if (plant.health < 35) issues.push({ severity: 'critical', label: `Dying (${Math.round(plant.health)}% health)` });
  else if (plant.health < 60) issues.push({ severity: 'warning', label: `Unhealthy (${Math.round(plant.health)}%)` });

  const req = plant.stageRequirements?.[plant.stage] || DEFAULT_STAGE_REQUIREMENTS[plant.stage];
  const lightsOn = climate.lightPPFD > LIGHTS_ON_PPFD;
  // With the lights off, judge everything except light level (which would always read "insufficient")
  const judged = lightsOn ? climate : { ...climate, lightPPFD: req.ppfdOptimal };
  const report = evaluatePlantStageSuitability(plant, judged, plant.rootTempF ?? 68, photoperiodHours);

  if (report.photoperiodStatus === 'flowering_interrupted') {
    issues.push({ severity: 'critical', label: `Wrong light cycle (${photoperiodHours}h/day, flowering needs 12h)` });
  } else if (report.photoperiodStatus === 'vegetative_trigger') {
    issues.push({ severity: 'warning', label: `Short light cycle (${photoperiodHours}h/day may trigger flowering)` });
  }

  if (report.tempStatus !== 'ideal') {
    const cold = report.tempStatus === 'too_cold';
    const off = cold ? req.tempMinF - climate.tempF : climate.tempF - req.tempMaxF;
    issues.push({
      severity: off > TEMP_CRITICAL_F ? 'critical' : 'warning',
      label: `${cold ? 'Too cold' : 'Too hot'} (${climate.tempF.toFixed(1)}°F, ${cold ? `min ${req.tempMinF}` : `max ${req.tempMaxF}`})`
    });
  }
  if (report.rhStatus !== 'ideal') {
    const dry = report.rhStatus === 'too_dry';
    const off = dry ? req.rhMin - climate.rh : climate.rh - req.rhMax;
    issues.push({
      severity: off > RH_CRITICAL ? 'critical' : 'warning',
      label: `${dry ? 'Air too dry' : 'Too humid'} (${Math.round(climate.rh)}%, ${dry ? `min ${req.rhMin}` : `max ${req.rhMax}`})`
    });
  }
  if (report.vpdStatus !== 'ideal') {
    const low = report.vpdStatus === 'too_low';
    issues.push({ severity: 'warning', label: `VPD ${low ? 'low' : 'high'} (${climate.vpdKpa.toFixed(2)}, ${low ? `min ${req.vpdMin}` : `max ${req.vpdMax}`})` });
  }
  if (lightsOn && report.ppfdStatus === 'insufficient') {
    issues.push({ severity: 'warning', label: `Low light (${Math.round(climate.lightPPFD)} PPFD, needs ${req.ppfdMin})` });
  } else if (lightsOn && report.ppfdStatus === 'excessive_burn') {
    issues.push({ severity: 'warning', label: `Light too intense (${Math.round(climate.lightPPFD)} PPFD)` });
  }
  if (report.rootTempStatus === 'chilled') issues.push({ severity: 'warning', label: `Cold roots (${(plant.rootTempF ?? 68).toFixed(0)}°F)` });
  if (report.rootTempStatus === 'hot') issues.push({ severity: 'warning', label: `Hot roots (${(plant.rootTempF ?? 68).toFixed(0)}°F)` });

  if (plant.soilMoisture < 20) issues.push({ severity: 'critical', label: 'Bone dry' });
  else if (report.moistureStatus === 'underwatered') issues.push({ severity: 'warning', label: `Needs water (${Math.round(plant.soilMoisture)}%)` });
  if (report.moistureStatus === 'waterlogged') issues.push({ severity: 'warning', label: 'Waterlogged' });

  if (plant.nutrientLevel === 'low') issues.push({ severity: 'warning', label: 'Hungry (low nutrients)' });
  return issues;
}

function mushroomIssues(shroom: MushroomItem, climate: Climate): CropIssue[] {
  const issues: CropIssue[] = [];
  if (shroom.isHarvested) return issues;

  if (shroom.traits?.sporeViabilityOutcome === 'failed') {
    return [{ severity: 'critical', label: 'Culture failed' }];
  }

  if (shroom.health < 35) issues.push({ severity: 'critical', label: `Dying (${Math.round(shroom.health)}% health)` });
  else if (shroom.health < 60) issues.push({ severity: 'warning', label: `Unhealthy (${Math.round(shroom.health)}%)` });

  // Same thresholds the simulation penalizes
  if (shroom.substrateMoisture < 25) issues.push({ severity: 'critical', label: 'Substrate drying out' });
  else if (shroom.substrateMoisture < 40) issues.push({ severity: 'warning', label: 'Substrate dry' });
  if (climate.rh < 70) issues.push({ severity: 'warning', label: 'Air too dry' });
  if ((shroom.stage === 'pinning' || shroom.stage === 'fruiting') && climate.co2Ppm > 1300 * (shroom.traits?.co2Tolerance || 1)) {
    issues.push({ severity: 'warning', label: 'CO₂ too high' });
  }
  if ((shroom.substrateTempF ?? climate.tempF) > 88) issues.push({ severity: 'critical', label: 'Substrate overheating' });
  return issues;
}

/**
 * Issues for a crop in its container (a tent's items, or a room / garden's floor items):
 * the container's climate and light schedule are what the crop experiences.
 */
/** Hydro plants that are watered from a reservoir: is one connected, and does it have solution? */
function feedIssues(plant: PlantItem, roomItems: Item[]): CropIssue[] {
  if (plant.isHarvested || !plant.systemType || !RESERVOIR_FED_SYSTEMS.includes(plant.systemType)) return [];
  const reservoir = getFeedingReservoir(plant, roomItems);
  if (!reservoir) return [{ severity: 'warning', label: 'No reservoir (connect a nutrient reservoir feed line)' }];
  if (isNutrientReservoirEmpty(reservoir)) return [{ severity: 'critical', label: `Reservoir empty (${reservoir.name})` }];
  if (!reservoir.powerOn) return [{ severity: 'warning', label: `Pump off (${reservoir.name})` }];
  if ((plant.aerationOxygenPct ?? 100) < LOW_ROOT_OXYGEN_PCT) {
    return [{ severity: 'warning', label: `Low root oxygen (${Math.round(plant.aerationOxygenPct ?? 0)}%: add an air stone or cool the water)` }];
  }
  return [];
}

/** roomItems: everything in the room (floor and tents), where a feeding reservoir may stand. */
export function getCropIssues(item: Item, climate: Climate, containerItems: Item[], outdoor = false, roomItems: Item[] = containerItems): CropIssue[] {
  const issues = item.category === 'plant' ? [...plantIssues(item, climate, getPhotoperiodHours(containerItems, outdoor)), ...feedIssues(item, roomItems)]
    : item.category === 'mushroom' ? mushroomIssues(item, climate)
    : [];
  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1));
}
