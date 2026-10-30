import { Climate, OutsideConditions, PlantItem, MushroomItem, EquipmentItem, PersonItem, PetItem, Room, Tent, ControllerPriority, JournalCategory } from '../types/sim';
import { evaluatePlantStageSuitability, getNextPlantStage, DEFAULT_STAGE_DURATIONS, getPepperCultivar, getPlantTargetSize, getContainerSizeFactor } from './plantLifecycle';
import { syncItemGeometry, getDefaultContainerVolumeGallons } from './spatial';
import { getDuctTargetTent, getDuctedEquipmentForTent, getMistWaterEffects, isHumidifier, stepReservoirTempF, getRootZoneHeat, applyRootZoneHeat, HOSE_DELIVERY_EFFICIENCY, RootZoneHeat, isReservoirEmpty, getOutdoorVentedCfm, getOutdoorFanShare, isDehumidifier, isBucketFull, getReservoirLevelL, getBucketLevelL, getBucketCapacityL, getMistWaterUseLph, getDehumidifierExtractionLph, absoluteHumidityGm3, shareEnclosureWater, CUBIC_METRES_PER_CUBIC_FOOT, MIST_EVAPORATION_EFFICIENCY } from './equipmentLinks';
import { INLINE_FAN_SPECS } from './equipmentCatalog';
import { getTentEnvelope } from './tentEnvelope';
import { getItemHeatWatts, getPortableAcMoistureLph, isLightScheduledOn, isRoomClimateUnit, stepRoomTemperature, RoomClimateUnitState, DEFAULT_REGISTER_CFM, REGISTER_COOL_SUPPLY_F } from './roomThermal';
export { isLightScheduledOn } from './roomThermal';
import { generateSeedTraits, generateSporeTraits } from './genetics';
import { getRootZoneWaterL, stepRoomNutrientReservoirs } from './nutrientReservoirs';
import { calculateTrayMicroclimate, isTrayWet } from './growRacks';

export interface SimulationEvent {
  type: 'warning' | 'info' | 'success' | 'action';
  category?: JournalCategory;
  title: string;
  message: string;
  tentName?: string;
}

export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

/**
 * Calculates Saturated Vapor Pressure in kPa for a given temperature in Celsius
 * Magnus-Tetens formula
 */
export function calculateSVP(tempC: number): number {
  return 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

/**
 * Calculates Actual Vapor Pressure in kPa
 */
export function calculateAVP(tempC: number, rh: number): number {
  return calculateSVP(tempC) * (Math.max(0, Math.min(100, rh)) / 100);
}

/**
 * Calculates Vapor Pressure Deficit (VPD) in kPa
 * Takes into account leaf temperature offset (default -1.8°C during active light transpiration)
 */
export function calculateVPD(tempF: number, rh: number, lightPPFD: number = 0): number {
  const airTempC = fahrenheitToCelsius(tempF);
  // Leaf cooling occurs during transpiration under light
  const leafOffsetC = lightPPFD > 50 ? -1.8 : -0.2;
  const leafTempC = airTempC + leafOffsetC;
  
  const svpLeaf = calculateSVP(leafTempC);
  const avpAir = calculateAVP(airTempC, rh);
  
  const vpd = svpLeaf - avpAir;
  return Math.max(0.01, parseFloat(vpd.toFixed(2)));
}

export type VpdZone = 'danger_low' | 'low_mushrooms' | 'optimal_veg' | 'optimal_flower' | 'danger_high';

export function getVpdZone(vpd: number, target: 'plant' | 'mushroom' = 'plant'): {
  zone: VpdZone;
  label: string;
  color: string;
  bgColor: string;
  description: string;
} {
  if (target === 'mushroom') {
    if (vpd < 0.2) {
      return {
        zone: 'danger_low',
        label: 'Saturated',
        color: 'text-blue-400',
        bgColor: 'bg-blue-950/40 border-blue-800/50',
        description: 'Condensation heavy. Watch for bacteria.'
      };
    }
    if (vpd <= 0.6) {
      return {
        zone: 'optimal_flower',
        label: 'Ideal Fruiting',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-950/40 border-emerald-800/50',
        description: 'Perfect 85-95% RH microclimate for mushrooms.'
      };
    }
    if (vpd <= 0.9) {
      return {
        zone: 'optimal_veg',
        label: 'Moderate',
        color: 'text-amber-400',
        bgColor: 'bg-amber-950/40 border-amber-800/50',
        description: 'A bit dry for pins. Mist frequently.'
      };
    }
    return {
      zone: 'danger_high',
      label: 'Too Dry',
      color: 'text-rose-400',
      bgColor: 'bg-rose-950/40 border-rose-800/50',
      description: 'Primordia will dry and abort.'
    };
  }

  // Plant target
  if (vpd < 0.4) {
    return {
      zone: 'danger_low',
      label: 'Low / Rot Risk',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-950/40 border-cyan-800/50',
      description: 'Very high humidity. Reduced transpiration, high mold risk.'
    };
  } else if (vpd < 0.8) {
    return {
      zone: 'low_mushrooms',
      label: 'Propagation & Early Veg',
      color: 'text-teal-400',
      bgColor: 'bg-teal-950/40 border-teal-800/50',
      description: 'Gentle on clones and young seedlings.'
    };
  } else if (vpd <= 1.2) {
    return {
      zone: 'optimal_veg',
      label: 'Optimal Veg',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40 border-emerald-800/50',
      description: 'Fast cellular growth, vigorous nutrient uptake.'
    };
  } else if (vpd <= 1.6) {
    return {
      zone: 'optimal_flower',
      label: 'Optimal Flower',
      color: 'text-lime-400',
      bgColor: 'bg-lime-950/40 border-lime-800/50',
      description: 'Ideal dense flower/fruit swelling with low rot risk.'
    };
  } else {
    return {
      zone: 'danger_high',
      label: 'High Stress',
      color: 'text-rose-400',
      bgColor: 'bg-rose-950/40 border-rose-800/50',
      description: 'Air is too dry/hot. Stomata close to conserve moisture.'
    };
  }
}

/**
 * Calculates Outside Weather conditions based on time of day and date
 * Robust climatology ensuring August in Massachusetts / US is realistic (82°F high, 73°F at 8 PM, 63°F low)
 */
export function simulateOutsideConditions(simTime: number): OutsideConditions {
  const date = new Date(simTime);
  const hour = date.getHours() + date.getMinutes() / 60;
  const month = date.getMonth(); // 0-11 (7 = August)
  
  // Seasonal variation:
  // Month 7 = August (summer): baseMean 73.0°F -> Peak day (15:00) 83°F, evening (20:00) 73.5°F, dawn (05:30) 63.5°F
  let baseMeanTemp = 73.0;
  let tempSwingAmp = 9.8;
  if (month === 7) { // August (peak summer)
    baseMeanTemp = 73.5;
    tempSwingAmp = 9.5; // High 83°F, Low 64°F
  } else if (month === 6) { // July
    baseMeanTemp = 75.0;
    tempSwingAmp = 10.0;
  } else if (month === 8) { // September
    baseMeanTemp = 65.0;
    tempSwingAmp = 9.0;
  } else if (month === 9) { // October
    baseMeanTemp = 53.0;
    tempSwingAmp = 8.5;
  } else {
    baseMeanTemp = 62.0;
    tempSwingAmp = 8.0;
  }
  
  // Daily diurnal curve: minimum at 05:30, maximum at 15:00
  const diurPhase = ((hour - 9) * 2 * Math.PI) / 24;
  const tempF = parseFloat((baseMeanTemp + tempSwingAmp * Math.sin(diurPhase)).toFixed(1));
  const tempC = parseFloat(fahrenheitToCelsius(tempF).toFixed(1));

  // RH is inversely correlated with temperature
  const baseRH = 64;
  const rhSwing = -15 * Math.sin(diurPhase);
  const rh = Math.max(38, Math.min(94, Math.round(baseRH + rhSwing)));

  // Day/Night photoperiod in August (lat 42°):
  // Sunrise is ~05:50, Sunset is ~19:48.
  // At 20:00+ (8 PM, e.g. 20:10), it is dusk/night! Sun has set.
  const isNight = hour >= 19.8 || hour < 5.8;

  let weather: OutsideConditions['weather'] = isNight ? 'clear_night' : 'sunny';
  if (rh > 84) weather = 'rainy';
  else if (rh > 74 && !isNight) weather = 'cloudy';
  else if (rh > 64 && !isNight) weather = 'partly_cloudy';

  // Solar light PPFD based on solar elevation
  // Must be strictly 0 PPFD when the sun has set (e.g. 20:10 8:10 PM)
  let lightPPFD = 0;
  if (!isNight) {
    const sunSine = Math.sin((Math.PI * (hour - 5.8)) / 14.0);
    const clearSkyPPFD = Math.max(0, 960 * Math.max(0, sunSine));
    if (weather === 'sunny') lightPPFD = Math.round(clearSkyPPFD);
    else if (weather === 'partly_cloudy') lightPPFD = Math.round(clearSkyPPFD * 0.65);
    else if (weather === 'cloudy') lightPPFD = Math.round(clearSkyPPFD * 0.35);
    else if (weather === 'rainy') lightPPFD = Math.round(clearSkyPPFD * 0.15);
  }

  return {
    tempF,
    tempC,
    rh,
    lightPPFD,
    co2Ppm: 420, // Atmospheric clean outdoor air baseline
    weather,
    windMph: parseFloat((7.0 + Math.sin(hour) * 2.5).toFixed(1)),
    pressureHpa: 1014 + Math.round(Math.sin(date.getDate()) * 4)
  };
}

/**
 * Checks if a light scheduled on/off is active for a given hour
 */
/**
 * Central Controller Arbitration Engine:
 * Prevents equipment from fighting each other (e.g. Humidifier vs Exhaust Fan, Humidifier vs Dehumidifier, CO2 Solenoid vs Exhaust).
 * Implements intelligent dynamic triggers for exhaust fans (temperature, humidity, CO2 FAE, low RH protection).
 */
export interface ArbitratedEquipmentResult {
  arbitratedItems: (PlantItem | MushroomItem | EquipmentItem | PersonItem | PetItem)[];
  effectiveFanSpeed: number;
  activeInterlocks: string[];
  activeHumidifierTarget: number | null;
  activeHumidifierCapacity: number;
  activeHumidifierCoolingPerCapacity: number; // Capacity-weighted mist cooling (°F / 5 min), from reservoir water temps
  activeDehumidifierTarget: number | null;
  activeDehumidifierCapacity: number;
  co2RegulatorActive: boolean;
  co2RegulatorTarget: number | null;
  totalHeatWatts: number;
  lightPPFD: number;
}

export function arbitrateEnclosureEquipment(params: {
  items: (PlantItem | MushroomItem | EquipmentItem | PersonItem | PetItem)[];
  climate: { tempF: number; rh: number; co2Ppm: number; lightPPFD?: number };
  ambientLungRoom: { tempF: number; rh: number; co2Ppm: number };
  priority: ControllerPriority;
  hour: number;
  simTime: number;
  isTent: boolean;
  baseFanSpeed: number;
  enclosureAreaSqFt: number;
}): ArbitratedEquipmentResult {
  const {
    items,
    climate,
    ambientLungRoom,
    priority,
    hour,
    simTime,
    isTent,
    baseFanSpeed,
    enclosureAreaSqFt
  } = params;

  const isShroomEnclosure = items.some(i => i.category === 'mushroom');
  const activeInterlocks: string[] = [];

  let totalHeatWatts = 0;
  let lightPPFD = 0;

  // 1. First Pass: Evaluate preliminary demands
  let activeHumidifierTarget: number | null = null;
  let activeHumidifierCapacity = 0;
  let humidifierCoolingWeighted = 0;
  let humidifierDemanded = false;

  let activeDehumidifierTarget: number | null = null;
  let activeDehumidifierCapacity = 0;
  let dehumidifierDemanded = false;

  let co2RegulatorTarget: number | null = null;
  let co2RegulatorActive = false;

  // Pre-calculate light status for CO2 and heat
  items.forEach(item => {
    if (item.category === 'equipment' && item.type === 'grow_light') {
      const isTimerOn = isLightScheduledOn(hour, item.schedule);
      if (item.powerOn && isTimerOn) {
        const powerRatio = (item.setting || 100) / 100;
        const effectiveWatts = (item.powerWatts || 100) * powerRatio;
        totalHeatWatts += effectiveWatts;
        const areaM2 = enclosureAreaSqFt * 0.0929;
        const ppfd = Math.round((effectiveWatts * 2.1) / Math.max(0.5, areaM2));
        lightPPFD = Math.max(lightPPFD, ppfd);
      }
    }
  });

  const isDay = lightPPFD > 40;

  // Evaluate Humidifier & Dehumidifier Preliminary Demands
  items.forEach(item => {
    if (item.category === 'equipment') {
      if (item.type === 'humidifier' && item.powerOn && !isReservoirEmpty(item)) {
        const target = item.targetRh ?? item.setting ?? (isShroomEnclosure ? 90 : 60);
        if (climate.rh < target - 1.0) {
          humidifierDemanded = true;
          activeHumidifierTarget = Math.max(activeHumidifierTarget ?? 0, target);
          const powerRatio = Math.max(0.1, (item.setting || 80) / 100);
          const wattsFactor = Math.max(0.8, (item.powerWatts || 60) / 60);
          // Reservoir water temperature shapes output; hose-ducted units lose a little to condensation
          const water = getMistWaterEffects(item.reservoirTempF ?? climate.tempF, climate.tempF);
          const hoseFactor = item.ductedToTentId ? HOSE_DELIVERY_EFFICIENCY : 1;
          const capacity = powerRatio * wattsFactor * water.outputFactor * hoseFactor;
          activeHumidifierCapacity += capacity;
          humidifierCoolingWeighted += capacity * water.coolingPerCapacity;
        }
      } else if (item.type === 'dehumidifier' && item.powerOn && !isBucketFull(item)) {
        const target = item.targetRh ?? 50;
        if (climate.rh > target + 1.5) {
          dehumidifierDemanded = true;
          activeDehumidifierTarget = Math.min(activeDehumidifierTarget ?? 100, target);
          const powerRatio = Math.max(0.1, (item.setting || 60) / 100);
          const wattsFactor = Math.max(0.8, (item.powerWatts || 150) / 150);
          activeDehumidifierCapacity += powerRatio * wattsFactor;
        }
      } else if (item.type === 'co2_regulator' && item.powerOn) {
        const target = item.targetCo2Ppm ?? 1200;
        if (climate.co2Ppm < target - 50 && isDay) {
          co2RegulatorActive = true;
          co2RegulatorTarget = target;
        }
      }
    }
  });

  // 2. Conflict Arbitration: Humidifier vs Dehumidifier
  let humidifierSuppressed = false;
  let dehumidifierSuppressed = false;

  if (humidifierDemanded && dehumidifierDemanded) {
    if (priority === 'humidity_first') {
      dehumidifierSuppressed = true;
      activeDehumidifierCapacity = 0;
      activeDehumidifierTarget = null;
      activeInterlocks.push('Dehumidifier locked out: Humidifier active (Humidity First Priority)');
    } else if (priority === 'temperature_first') {
      humidifierSuppressed = false;
    } else {
      // Balanced auto: use 55% RH deadband split
      if (climate.rh < 58) {
        dehumidifierSuppressed = true;
        activeDehumidifierCapacity = 0;
        activeDehumidifierTarget = null;
        activeInterlocks.push('Dehumidifier locked out: Humidity below comfort threshold');
      } else {
        humidifierSuppressed = true;
        activeHumidifierCapacity = 0;
        activeHumidifierTarget = null;
        activeInterlocks.push('Humidifier locked out: Dehumidifier active (High RH)');
      }
    }
  }

  // 3. Second Pass: Evaluate and arbitrate each item
  let maxExhaustFanOutput = baseFanSpeed;

  const arbitratedItems = items.map(item => {
    if (item.category !== 'equipment') {
      return item;
    }

    const eq: EquipmentItem = { ...item };

    // Default control mode to auto if unspecified
    const mode = eq.controlMode || 'auto';

    if (!eq.powerOn) {
      eq.effectiveSetting = 0;
      eq.interlockStatus = 'Power switched off';
      return eq;
    }

    // A. GROW LIGHTS
    if (eq.type === 'grow_light') {
      const isTimerOn = isLightScheduledOn(hour, eq.schedule);
      if (isTimerOn) {
        eq.effectiveSetting = eq.setting;
        eq.interlockStatus = eq.schedule?.enabled ? 'On (Scheduled photoperiod)' : 'On (Continuous 24/0)';
      } else {
        eq.effectiveSetting = 0;
        eq.interlockStatus = eq.schedule?.enabled === false
          ? 'Off (Schedule disabled: Germination darkness)'
          : 'Off (Night cycle by schedule)';
      }
      return eq;
    }

    // B. HUMIDIFIERS
    if (eq.type === 'humidifier') {
      const target = eq.targetRh ?? eq.setting ?? (isShroomEnclosure ? 90 : 60);
      if (isReservoirEmpty(eq)) {
        eq.effectiveSetting = 0;
        eq.interlockStatus = 'Out of water: Refill reservoir';
      } else if (humidifierSuppressed) {
        eq.effectiveSetting = 0;
        eq.interlockStatus = 'Locked out: Dehumidifier arbitration active';
      } else if (climate.rh >= target) {
        eq.effectiveSetting = 0;
        eq.interlockStatus = `Idle: Target reached (${climate.rh}% ≥ ${target}%)`;
      } else {
        eq.effectiveSetting = eq.setting;
        eq.interlockStatus = `Misting: Raising RH to ${target}%`;
      }
      return eq;
    }

    // C. DEHUMIDIFIERS
    if (eq.type === 'dehumidifier') {
      const target = eq.targetRh ?? 50;
      if (isBucketFull(eq)) {
        eq.effectiveSetting = 0;
        eq.interlockStatus = 'Bucket full: Empty collection bucket';
      } else if (dehumidifierSuppressed) {
        eq.effectiveSetting = 0;
        eq.interlockStatus = 'Locked out: Humidifier priority active';
      } else if (climate.rh <= target) {
        eq.effectiveSetting = 0;
        eq.interlockStatus = `Idle: Target reached (${climate.rh}% ≤ ${target}%)`;
      } else {
        eq.effectiveSetting = eq.setting;
        eq.interlockStatus = `Dehumidifying: Extracting moisture to ${target}%`;
      }
      return eq;
    }

    // D. HEATERS
    if (eq.type === 'heater') {
      const target = eq.targetTempF ?? 74;
      if (climate.tempF < target - 0.5) {
        eq.effectiveSetting = eq.setting;
        eq.interlockStatus = `Heating: Current ${climate.tempF.toFixed(1)}°F < Target ${target}°F`;
      } else {
        eq.effectiveSetting = 0;
        eq.interlockStatus = `Idle: Temp satisfied (${climate.tempF.toFixed(1)}°F ≥ ${target}°F)`;
      }
      return eq;
    }

    // E. CO2 REGULATOR SOLENOID
    if (eq.type === 'co2_regulator') {
      const target = eq.targetCo2Ppm ?? 1200;
      if (!isDay) {
        eq.effectiveSetting = 0;
        eq.interlockStatus = 'Solenoid closed: Night cycle (Stomata closed)';
      } else if (climate.co2Ppm >= target) {
        eq.effectiveSetting = 0;
        eq.interlockStatus = `Idle: Canopy enriched (${climate.co2Ppm} ≥ ${target} PPM)`;
      } else {
        eq.effectiveSetting = eq.setting;
        eq.interlockStatus = `Injecting: Enriching canopy to ${target} PPM`;
      }
      return eq;
    }

    // F. EXHAUST FANS (INTELLIGENT DYNAMIC TRIGGERS & CONFLICT PROTECTION)
    if (eq.type === 'exhaust_fan') {
      const triggers = eq.autoTriggers || {};
      // Off unless a trigger calls for air; an idling fan just vents heat & humidity the tent needs
      const minSpeed = triggers.minSpeedPercent ?? 0;
      const maxSpeed = triggers.maxSpeedPercent ?? (eq.setting || 100);

      const tempHighTrigger = triggers.tempTriggerHighF ?? (isShroomEnclosure ? 76 : 79);
      const rhHighTrigger = triggers.rhTriggerHigh ?? (isShroomEnclosure ? 98 : 68);
      const rhLowFloor = triggers.rhTriggerLow ?? (isShroomEnclosure ? 80 : 45);
      const co2HighTrigger = triggers.co2TriggerHighPpm ?? (isShroomEnclosure ? 950 : 1500);
      const co2LowTrigger = triggers.co2TriggerLowPpm ?? 380;

      let demandedSpeed = minSpeed;
      let activeTriggerReasons: string[] = [];

      if (mode === 'manual') {
        demandedSpeed = eq.setting;
        activeTriggerReasons.push(`Manual fixed speed (${eq.setting}%)`);
      } else if (mode === 'cycle') {
        const cycleOn = triggers.cycleOnMinutes ?? 3;
        const cycleOff = triggers.cycleOffMinutes ?? 20;
        const totalCycle = cycleOn + cycleOff;
        const minuteIndex = Math.floor(simTime / 60000) % totalCycle;
        if (minuteIndex < cycleOn) {
          demandedSpeed = eq.setting;
          activeTriggerReasons.push(`Cycle timer active pulse (${cycleOn - minuteIndex}m left)`);
        } else {
          demandedSpeed = minSpeed;
          activeTriggerReasons.push(`Cycle timer idle (${totalCycle - minuteIndex}m to next pulse)`);
        }
      } else {
        // Mode === 'auto' (Intelligent environmental triggers)
        // 1. High Temp Trigger:
        if (climate.tempF > tempHighTrigger) {
          const excessTemp = climate.tempF - tempHighTrigger;
          const heatSpeed = Math.min(maxSpeed, Math.round(minSpeed + excessTemp * 15 + 25));
          if (heatSpeed > demandedSpeed) {
            demandedSpeed = heatSpeed;
            activeTriggerReasons.push(`High Temp (${climate.tempF.toFixed(1)}°F > ${tempHighTrigger}°F)`);
          }
        }

        // 2. High Humidity Trigger (evacuate excess moisture):
        if (climate.rh > rhHighTrigger) {
          const excessRh = climate.rh - rhHighTrigger;
          const rhSpeed = Math.min(maxSpeed, Math.round(minSpeed + excessRh * 6 + 30));
          if (rhSpeed > demandedSpeed) {
            demandedSpeed = rhSpeed;
            activeTriggerReasons.push(`High RH (${climate.rh}% > ${rhHighTrigger}%)`);
          }
        }

        // 3. High CO2 Trigger (Mushroom FAE evacuation):
        if (climate.co2Ppm > co2HighTrigger) {
          const excessCo2 = climate.co2Ppm - co2HighTrigger;
          const co2Speed = Math.min(maxSpeed, Math.round(minSpeed + Math.min(60, excessCo2 * 0.15) + 30));
          if (co2Speed > demandedSpeed) {
            demandedSpeed = co2Speed;
            activeTriggerReasons.push(`High CO₂ FAE (${climate.co2Ppm} > ${co2HighTrigger} PPM)`);
          }
        }

        // 4. Low CO2 Trigger (Plants starving for carbon under daylight):
        if (climate.co2Ppm < co2LowTrigger && isDay) {
          const co2DeficitSpeed = Math.min(maxSpeed, 45);
          if (co2DeficitSpeed > demandedSpeed) {
            demandedSpeed = co2DeficitSpeed;
            activeTriggerReasons.push(`Low CO₂ intake (${climate.co2Ppm} < ${co2LowTrigger} PPM)`);
          }
        }
      }

      // 4. CENTRAL CONTROLLER INTERLOCKS & PROTECTION ARBITRATION
      let arbitratedSpeed = demandedSpeed;
      let interlockReason = '';

      // Conflict A: Humidifier is actively misting!
      if (humidifierDemanded && !humidifierSuppressed) {
        if (priority === 'humidity_first') {
          // In Humidity First mode, exhausting mist defeats the fogger
          // Only emergency extreme temperature (> 88°F) can overrule
          if (climate.tempF >= 88) {
            interlockReason = 'Emergency Thermal Overrule: Venting despite active humidifier';
            activeInterlocks.push('Emergency Overrule: High heat forcing exhaust fan on');
          } else {
            arbitratedSpeed = Math.min(minSpeed, 5);
            interlockReason = 'Locked out: Humidifier misting (Humidity First Priority)';
            activeInterlocks.push('Exhaust Fan suspended: Humidifier actively misting (Humidity First)');
          }
        } else if (priority === 'balanced_auto') {
          // Balanced mode: throttle exhaust to gentle exchange (max 15%) while misting
          if (arbitratedSpeed > 15 && climate.tempF < 82) {
            arbitratedSpeed = 15;
            interlockReason = 'Throttled to 15%: Humidifier active (Balanced Auto)';
            activeInterlocks.push('Exhaust Fan throttled: Humidifier actively raising moisture');
          }
        }
      }

      // Conflict B: CO2 Solenoid is actively injecting bottled gas!
      if (co2RegulatorActive && (priority === 'co2_enrichment' || priority === 'balanced_auto')) {
        if (climate.tempF < 84) {
          arbitratedSpeed = Math.min(arbitratedSpeed, minSpeed);
          interlockReason = 'Suspended: CO₂ Solenoid injecting gas';
          activeInterlocks.push('Exhaust Fan suspended: Preserving injected CO₂');
        }
      }

      // Protection C: Low Humidity Floor Safeguard
      // If enclosure humidity drops below rhLowFloor, prevent exhaust from desiccating crops
      if (climate.rh < rhLowFloor && climate.tempF < 85 && mode !== 'manual') {
        if (arbitratedSpeed > minSpeed) {
          arbitratedSpeed = minSpeed;
          interlockReason = `Low RH Guard: Suspended (${climate.rh}% < ${rhLowFloor}% limit)`;
          activeInterlocks.push(`Exhaust Fan guarded: RH below ${rhLowFloor}% threshold`);
        }
      }

      eq.effectiveSetting = Math.max(0, Math.min(100, arbitratedSpeed));
      eq.interlockStatus = interlockReason || (
        activeTriggerReasons.length > 0 
          ? `Auto Active: ${activeTriggerReasons.join(', ')}`
          : (eq.effectiveSetting > 0 ? `Running at idle (${eq.effectiveSetting}%)` : 'Standby: All parameters optimal')
      );

      maxExhaustFanOutput = Math.max(maxExhaustFanOutput, eq.effectiveSetting);
      return eq;
    }

    return eq;
  });

  return {
    arbitratedItems,
    effectiveFanSpeed: maxExhaustFanOutput,
    activeInterlocks,
    activeHumidifierTarget,
    activeHumidifierCapacity,
    activeHumidifierCoolingPerCapacity: activeHumidifierCapacity > 0 ? humidifierCoolingWeighted / activeHumidifierCapacity : 0,
    activeDehumidifierTarget,
    activeDehumidifierCapacity,
    co2RegulatorActive,
    co2RegulatorTarget,
    totalHeatWatts,
    lightPPFD
  };
}

/**
 * Simulates a single tick of the environmental physics loop
 * elapsedMinutes: number of game minutes progressed
 */
export function simulateEnvironmentTick(
  room: Room,
  outside: OutsideConditions,
  currentSimTime: number,
  elapsedMinutes: number
): { room: Room; events: SimulationEvent[] } {
  const events: SimulationEvent[] = [];
  const date = new Date(currentSimTime);
  const hour = date.getHours() + date.getMinutes() / 60;
  
  // 1. UPDATE ROOM CLIMATE (Indoor Envelope vs Outdoor Garden vs Greenhouse)
  const isOutdoorGarden = room.environmentType === 'outdoor_garden';
  const isGreenhouse = room.environmentType === 'greenhouse';

  const roomVolCuFt = Math.max(100, room.dimensions.length * room.dimensions.width * room.dimensions.height);
  const wallAreaSqFt = 2 * (room.dimensions.length + room.dimensions.width) * room.dimensions.height;
  const rValue = room.wallRValue || 19;
  const ach = room.airChangesPerHour || 0.35;

  let roomTempF = room.climate.tempF;
  let roomRH = room.climate.rh;
  let roomCo2 = room.climate.co2Ppm || 420;

  // Water each room-floor humidifier used / dehumidifier collected this tick (litres), from the
  // vapour it actually added to or removed from the room air
  const roomWaterL = new Map<string, number>();
  const roomVolM3 = roomVolCuFt * CUBIC_METRES_PER_CUBIC_FOOT;
  // Announce the moment a tank runs dry or a bucket fills
  const announceWaterLimits = <T extends Tent['items'][number]>(before: T, after: T, location?: string): T => {
    if (before.category !== 'equipment' || after.category !== 'equipment') return after;
    if (before.type === 'humidifier' && !isReservoirEmpty(before) && isReservoirEmpty(after)) {
      events.push({
        type: 'warning',
        category: 'alert',
        tentName: location,
        title: `💧 Reservoir Empty: ${before.name}`,
        message: `${before.name} ran out of water and stopped misting. Refill its reservoir to resume humidifying.`
      });
    } else if (before.type === 'dehumidifier' && !isBucketFull(before) && isBucketFull(after)) {
      events.push({
        type: 'warning',
        category: 'alert',
        tentName: location,
        title: `🪣 Bucket Full: ${before.name}`,
        message: `${before.name}'s collection bucket is full and it shut off. Empty the bucket (or connect a drain hose) to resume dehumidifying.`
      });
    }
    return after;
  };
  let roomLightPPFD = 10;
  // Live state of the room's heaters / A/Cs / registers (written back to their items below)
  let roomClimateUnitStates = new Map<string, RoomClimateUnitState>();

  if (isOutdoorGarden) {
    // Open outdoor atmosphere directly governs temperature, humidity, CO2, and solar PPFD
    roomTempF = outside.tempF;
    roomRH = outside.rh;
    roomCo2 = outside.co2Ppm || 420;
    roomLightPPFD = outside.lightPPFD;
  } else if (isGreenhouse) {
    // Solar thermal gain through polycarbonate/glass glazing
    const solarThermalBoost = outside.lightPPFD > 400 ? 5.5 : 1.5;
    roomTempF = Math.max(outside.tempF, outside.tempF + solarThermalBoost);
    roomRH = Math.min(95, outside.rh + 6);
    roomCo2 = outside.co2Ppm || 420;
    roomLightPPFD = Math.round(outside.lightPPFD * 0.82); // 82% solar transmittance
  } else {
    // Indoor room: heat lost through its envelope (to the outdoors, the ground and the rest of the
    // house), heat from everything running in it (tents included), and only the heating / cooling
    // equipment actually placed here. No hidden HVAC.
    let vaporGm3 = absoluteHumidityGm3(roomTempF, roomRH);

    // Outdoor air leaking in brings its own moisture and CO2
    // Air ducted outdoors by exhaust fans (tent fans at their last output, room fans at their
    // setting) must be replaced: it's drawn in from outdoors as extra make-up air
    const tentVentedCfm = room.tents.map(t => getOutdoorVentedCfm(t.items, true));
    const ventedCfm = tentVentedCfm.reduce((a, b) => a + b, 0) + getOutdoorVentedCfm(room.items, false);
    const makeupAch = (ventedCfm * 60) / roomVolCuFt;
    const infiltrationFraction = Math.min(0.5, (ach + makeupAch) * (elapsedMinutes / 60));
    vaporGm3 += (absoluteHumidityGm3(outside.tempF, outside.rh) - vaporGm3) * infiltrationFraction;
    roomCo2 += (outside.co2Ppm - roomCo2) * infiltrationFraction;

    const gainsWatts = [...room.items.filter(i => !isRoomClimateUnit(i)), ...room.tents.flatMap(t => t.items)]
      .reduce((sum, i) => sum + getItemHeatWatts(i, hour), 0);
    // Heat that tents duct straight outside never reaches the room
    const ventedTentHeatWatts = room.tents.reduce((sum, t, i) => sum + (1.08 * tentVentedCfm[i] * (t.climate.tempF - roomTempF)) / 3.412, 0);
    const thermal = stepRoomTemperature({
      room,
      tempF: roomTempF,
      outdoorTempF: outside.tempF,
      gainsWatts: gainsWatts - ventedTentHeatWatts,
      elapsedMinutes,
      extraOutdoorUa: 1.08 * ventedCfm
    });
    roomTempF = thermal.tempF;
    roomClimateUnitStates = thermal.units;

    // A/Cs condense moisture out of the air; cooling registers swap room air for dry supply air
    for (const unit of room.items) {
      const runMinutes = thermal.coolingRunMinutes.get(unit.id) ?? 0;
      if (runMinutes <= 0 || unit.category !== 'equipment') continue;
      if (unit.type === 'portable_ac') {
        vaporGm3 -= (getPortableAcMoistureLph(unit, roomRH) * (runMinutes / 60) * 1000) / roomVolM3;
      } else if (unit.type === 'hvac_register') {
        const exchanged = Math.min(1, ((unit.flowRateCfm ?? DEFAULT_REGISTER_CFM) * runMinutes) / roomVolCuFt);
        const supplyVapor = absoluteHumidityGm3(REGISTER_COOL_SUPPLY_F, 95);
        if (supplyVapor < vaporGm3) vaporGm3 += (supplyVapor - vaporGm3) * exchanged;
      }
    }
    // The same water vapour at the new temperature: warming the room lowers RH, cooling raises it
    roomRH = Math.max(5, Math.min(100, (Math.max(0, vaporGm3) / absoluteHumidityGm3(roomTempF, 100)) * 100));

    // Biological Respiration from Occupants in Room (People & Pets)
    const roomVolLiters = roomVolCuFt * 28.3168;
    let roomOccupantCo2LitersPerHour = 0;
    let roomOccupantHeatWatts = 0;
    let roomOccupantMoistureLitersPerDay = 0;

    room.items.forEach(item => {
      if (item.category === 'person' || item.category === 'pet') {
        roomOccupantCo2LitersPerHour += (item as any).co2RateLitersPerHour || 0;
        roomOccupantHeatWatts += (item as any).heatOutputWatts || 0;
        roomOccupantMoistureLitersPerDay += (item as any).moistureLitersPerDay || 0;
      }
    });

    if (roomOccupantCo2LitersPerHour > 0) {
      const emittedLiters = roomOccupantCo2LitersPerHour * (elapsedMinutes / 60);
      const addedPpm = (emittedLiters / roomVolLiters) * 1_000_000;
      roomCo2 += addedPpm;
    }

    if (roomOccupantMoistureLitersPerDay > 0) {
      const moistureGrams = (roomOccupantMoistureLitersPerDay * 1000 / 1440) * elapsedMinutes;
      const rhDelta = (moistureGrams / (roomVolCuFt * 0.03)) * 0.01;
      roomRH = Math.min(95, roomRH + rhDelta);
    }

    // Equipment in the main room
    room.items.forEach(item => {
      if (item.category === 'equipment' && item.powerOn) {
        if (item.type === 'dehumidifier') {
          if (isBucketFull(item)) return;
          const target = item.targetRh ?? 50;
          if (roomRH > target) {
            // Pull out up to the unit's capacity at these conditions (and what its bucket has room
            // for), stopping once the room is down to target
            const satGm3 = absoluteHumidityGm3(roomTempF, 100);
            const bucketRoomL = item.drainHoseConnected ? Infinity : getBucketCapacityL(item) - getBucketLevelL(item);
            const capacityG = Math.min(bucketRoomL, getDehumidifierExtractionLph(item, item.setting, roomRH, roomTempF) * (elapsedMinutes / 60)) * 1000;
            const removedG = Math.max(0, Math.min(capacityG, ((roomRH - target) / 100) * satGm3 * roomVolM3));
            roomRH -= (removedG / (satGm3 * roomVolM3)) * 100;
            roomWaterL.set(item.id, removedG / 1000);
          }
        } else if (item.type === 'humidifier') {
          // Hose-ducted units mist into their tent instead (handled in the tent loop)
          if (getDuctTargetTent(room, item) || isReservoirEmpty(item)) return;
          const target = item.targetRh ?? 60;
          if (roomRH < target) {
            // Mist up to the unit's rated output (and the water it has left), stopping once the
            // room reaches target; some atomized water settles out instead of evaporating
            const { outputFactor } = getMistWaterEffects(item.reservoirTempF ?? roomTempF, roomTempF);
            const satGm3 = absoluteHumidityGm3(roomTempF, 100);
            const maxWaterL = Math.min(getReservoirLevelL(item), getMistWaterUseLph(item, item.setting) * outputFactor * (elapsedMinutes / 60));
            const addedG = Math.max(0, Math.min(maxWaterL * 1000 * MIST_EVAPORATION_EFFICIENCY, ((target - roomRH) / 100) * satGm3 * roomVolM3));
            roomRH += (addedG / (satGm3 * roomVolM3)) * 100;
            roomWaterL.set(item.id, addedG / 1000 / MIST_EVAPORATION_EFFICIENCY);
          }
        } else if (item.type === 'co2_regulator') {
          // Hose-ducted controllers inject into their tent instead (handled in the tent loop)
          if (getDuctTargetTent(room, item)) return;
          const targetCo2 = item.targetCo2Ppm ?? 1000;
          if (roomCo2 < targetCo2) {
            roomCo2 = Math.min(targetCo2, roomCo2 + 15 * (item.setting / 100) * (elapsedMinutes / 5));
          }
        }
      }
    });

    // Not rounded: with the room's ~1.4 h time constant, a 1-minute tick moves it only a few hundredths of a degree
    roomTempF = Math.max(35, Math.min(115, roomTempF));
    // One decimal: a single unit moves room RH by a fraction of a percent per minute
    roomRH = Math.max(20, Math.min(95, Math.round(roomRH * 10) / 10));
    roomCo2 = Math.max(350, Math.min(5000, roomCo2)); // unrounded: per-minute exchange is a fraction of a ppm
  }

  const roomTempC = parseFloat(fahrenheitToCelsius(roomTempF).toFixed(1));
  const roomVPD = calculateVPD(roomTempF, roomRH, roomLightPPFD);

  // 2. UPDATE EACH TENT'S CLIMATE & ITS ITEMS
  // Arbitrated copies of room-level humidifiers that are hose-ducted into a tent (written back to room.items)
  const ductedArbitrated = new Map<string, EquipmentItem>();

  const updatedTents: Tent[] = room.tents.map(tent => {
    let tTempF = tent.climate.tempF;
    let tRH = tent.climate.rh;
    let tCo2 = tent.climate.co2Ppm || roomCo2;

    const tentAreaSqFt = Math.max(1, tent.dimensions.length * tent.dimensions.width);
    const tentVolCuFt = Math.max(30, tentAreaSqFt * tent.dimensions.height);

    // Run Central Controller Arbitration for this tent!
    const defaultPriority: ControllerPriority = tent.items.some(i => i.category === 'mushroom') 
      ? 'humidity_first' 
      : 'balanced_auto';
    const tentPriority: ControllerPriority = tent.controllerPriority || defaultPriority;

    const hasExhaustFanInstalled = tent.items.some(i => i.category === 'equipment' && i.type === 'exhaust_fan');
    const baseFanSpeed = hasExhaustFanInstalled ? (tent.exhaustFanSpeed || 0) : 0;

    // Reservoirs drift toward the air around the unit (tent air in here, room air for hose-ducted units)
    // and are warmed by any heat mat wrapped around them (mats live in the same container as the unit)
    const withReservoir = (item: Tent['items'][number], ambientF: number, containerItems: Tent['items']) =>
      isHumidifier(item) ? { ...item, reservoirTempF: stepReservoirTempF(item, ambientF, elapsedMinutes, containerItems) } : item;
    const ductedEquipment = getDuctedEquipmentForTent(room, tent.id).map(i => withReservoir(i, roomTempF, room.items));
    const ductedIds = new Set(ductedEquipment.map(i => i.id));

    const arbitration = arbitrateEnclosureEquipment({
      items: [...tent.items.map(i => withReservoir(i, tTempF, tent.items)), ...ductedEquipment],
      climate: { tempF: tTempF, rh: tRH, co2Ppm: tCo2, lightPPFD: tent.climate.lightPPFD },
      ambientLungRoom: { tempF: roomTempF, rh: roomRH, co2Ppm: roomCo2 },
      priority: tentPriority,
      hour,
      simTime: currentSimTime,
      isTent: true,
      baseFanSpeed,
      enclosureAreaSqFt: tentAreaSqFt
    });

    const {
      arbitratedItems: allArbitratedItems,
      effectiveFanSpeed,
      activeInterlocks,
      activeHumidifierTarget,
      activeHumidifierCapacity,
      activeHumidifierCoolingPerCapacity,
      activeDehumidifierTarget,
      activeDehumidifierCapacity,
      co2RegulatorActive,
      co2RegulatorTarget,
      totalHeatWatts,
      lightPPFD: tLightPPFD
    } = arbitration;

    // Hose-ducted units live in room.items; pull them back out of this tent's item list
    // Hose-ducted units are written back to room.items once this tent's water flow is settled below
    let arbitratedItems = allArbitratedItems.filter(item => !ductedIds.has(item.id));

    // Check biological occupants in tent
    arbitratedItems.forEach(item => {
      if (item.category === 'person' || item.category === 'pet') {
        const tentVolLiters = tentVolCuFt * 28.3168;
        const emittedLiters = (item as any).co2RateLitersPerHour * (elapsedMinutes / 60);
        tCo2 += (emittedLiters / tentVolLiters) * 1_000_000;
        tRH = Math.min(99, tRH + 0.1 * (elapsedMinutes / 5));
      }
    });

    // Ventilation & air exchange with the host room (arbitrated effectiveFanSpeed respects
    // humidifier lockouts & auto triggers). A 6" fan (~400 CFM) on a 4x4 tent (~107 cu ft) is the
    // reference for the moisture / CO2 exchange below; bigger fans or smaller tents exchange faster.
    const fanCfm = tent.items.reduce((sum, i) => i.category === 'equipment' && i.type === 'exhaust_fan'
      ? sum + (i.flowRateCfm || INLINE_FAN_SPECS[i.ductSizeIn || 6].cfm) : sum, 0);
    const cfmFactor = fanCfm > 0 ? Math.max(0.25, Math.min(3, (fanCfm / tentVolCuFt) / (402 / 107))) : 1;
    const fanFraction = (effectiveFanSpeed / 100) * cfmFactor;
    const airExchangeFraction = Math.min(0.95, 1 - Math.exp(-Math.max(0.04, fanFraction * 0.45) * elapsedMinutes));

    // Tent heat balance (BTU/h, °F). Everything running inside (lights, heaters, fans, a dehumidifier's
    // condensation heat, minus a humidifier's evaporative cooling) heats the tent air; it loses heat to
    // the room through the mylar walls, roof and floor and with the air the fan (or passive leakage)
    // swaps out. Solved exactly over the step, so the tent settles at room + gains / losses.
    const tentGainBtuh = arbitratedItems.reduce((sum, i) => sum + getItemHeatWatts(i, hour), 0) * 3.412;
    const tentShellSqFt = 2 * (tent.dimensions.length + tent.dimensions.width) * tent.dimensions.height + 2 * tentAreaSqFt;
    // Shell U-value and passive leakage come from the tent's construction (fabric, liner, seal quality)
    const envelope = getTentEnvelope(tent);
    // Real airflow: the fan's rated CFM at its output, derated ~30% for carbon filter and ducting,
    // plus passive leakage through zips and vents
    const exchangeCfm = fanCfm * (effectiveFanSpeed / 100) * 0.7 + tentVolCuFt * envelope.leakAch / 60;
    const tentLossUa = envelope.uValue * tentShellSqFt + 1.08 * exchangeCfm;
    // Heat capacity: the air plus what it's in contact with (frame, fabric, trays, pots), ~1 BTU/°F per ft² of floor
    const tentCapacity = tentVolCuFt * 0.018 + tentAreaSqFt * 1.0;
    const tentEquilibriumF = roomTempF + tentGainBtuh / tentLossUa;
    tTempF = tentEquilibriumF + (tTempF - tentEquilibriumF) * Math.exp(-(tentLossUa / tentCapacity) * (elapsedMinutes / 60));

    // Relative Humidity dynamics:
    const tentVolM3 = tentVolCuFt * CUBIC_METRES_PER_CUBIC_FOOT;
    const vaporBeforeGm3 = absoluteHumidityGm3(tTempF, tRH);
    if (activeHumidifierTarget !== null && activeHumidifierCapacity > 0) {
      // Sonic fogger saturation
      const exhaustDamping = 1 / (1 + fanFraction * 0.12);
      const steadyStateRH = Math.max(roomRH, activeHumidifierTarget * exhaustDamping);

      if (tRH < steadyStateRH) {
        const humidifyFraction = 1 - Math.exp(-Math.max(0.4, activeHumidifierCapacity * 0.6) * elapsedMinutes);
        tRH = tRH + (steadyStateRH - tRH) * humidifyFraction;
      } else if (tRH > activeHumidifierTarget) {
        tRH += (roomRH - tRH) * airExchangeFraction;
      }
    } else if (activeDehumidifierTarget !== null && activeDehumidifierCapacity > 0) {
      if (tRH > activeDehumidifierTarget) {
        const dehumFraction = 1 - Math.exp(-Math.max(0.25, activeDehumidifierCapacity * 0.4) * elapsedMinutes);
        tRH = tRH + (activeDehumidifierTarget - tRH) * dehumFraction;
      } else {
        tRH += (roomRH - tRH) * airExchangeFraction;
      }
    } else {
      // Passive ventilation only
      tRH += (roomRH - tRH) * airExchangeFraction;
    }

    // Water actually moved this tick: what the air gained or lost, plus what the air exchange carried
    // through while humidity was held above (humidifying) or below (dehumidifying) the room's
    const vaporAfterGm3 = absoluteHumidityGm3(tTempF, tRH);
    const roomVaporGm3 = absoluteHumidityGm3(roomTempF, roomRH);
    let humidifierWaterL = 0;
    let dehumidifierWaterL = 0;
    if (activeHumidifierTarget !== null && activeHumidifierCapacity > 0) {
      const vaporG = (Math.max(0, vaporAfterGm3 - vaporBeforeGm3) + airExchangeFraction * Math.max(0, vaporAfterGm3 - roomVaporGm3)) * tentVolM3;
      humidifierWaterL = vaporG / 1000 / MIST_EVAPORATION_EFFICIENCY;
    } else if (activeDehumidifierTarget !== null && activeDehumidifierCapacity > 0) {
      const vaporG = (Math.max(0, vaporBeforeGm3 - vaporAfterGm3) + airExchangeFraction * Math.max(0, roomVaporGm3 - vaporAfterGm3)) * tentVolM3;
      dehumidifierWaterL = vaporG / 1000;
    }
    const enclosureEquipment = [...arbitratedItems, ...allArbitratedItems.filter(item => ductedIds.has(item.id))];
    const watered = shareEnclosureWater(enclosureEquipment, humidifierWaterL, dehumidifierWaterL, { rh: tent.climate.rh, tempF: tent.climate.tempF }, elapsedMinutes)
      .map((item, i) => announceWaterLimits(enclosureEquipment[i], item, tent.name));
    arbitratedItems = watered.filter(item => !ductedIds.has(item.id));
    watered.filter(item => ductedIds.has(item.id)).forEach(item => {
      const eq = item as EquipmentItem;
      ductedArbitrated.set(eq.id, { ...eq, interlockStatus: `${eq.interlockStatus} → ${eq.type === 'co2_regulator' ? 'tubing' : 'hose'} into ${tent.name}` });
    });

    // Heat & humidity return to lung room (discharge into the host room)
    // (The tent's heat reaches the room through the room's heat balance, which counts every tent's equipment.)
    // The tent's exhausted air carries its water vapour into the room (humid tents are what a
    // grow room's dehumidifier ends up collecting); a drier tent pulls a little out instead
    // Only air that isn't ducted outdoors comes back into the room (an outdoor duct carries the fan's share away)
    const fanRate = fanFraction * 0.45;
    const roomReturnShare = 1 - getOutdoorFanShare(arbitratedItems) * Math.min(1, fanRate / Math.max(0.04, fanRate));
    const exhaustedVaporG = airExchangeFraction * roomReturnShare * tentVolM3 * (vaporAfterGm3 - roomVaporGm3);
    roomRH = Math.max(20, Math.min(95, roomRH + (exhaustedVaporG / (absoluteHumidityGm3(roomTempF, 100) * roomVolM3)) * 100));

    // 4. CANOPY CO2 MASS BALANCE & EXPONENTIAL DECAY
    // Continuous ventilation continuously pulls in host room air (roomCo2, e.g. 420 PPM).
    // Living plants absorb CO2 under light; mushrooms & occupants emit CO2.
    const livingPlants = tent.items.filter(i => i.category === 'plant' && !(i as PlantItem).isHarvested) as PlantItem[];
    const livingMushrooms = tent.items.filter(i => i.category === 'mushroom' && !(i as MushroomItem).isHarvested) as MushroomItem[];
    const isDay = tLightPPFD > 80;

    let tCo2Target = roomCo2;

    if (co2RegulatorActive && co2RegulatorTarget && isDay) {
      // Solenoid regulator injects gas to hold target under light (e.g. 1200 PPM)
      tCo2Target = co2RegulatorTarget;
    } else if (livingMushrooms.length > 0) {
      // Mushrooms respire CO2 around the clock. The tent settles where that production balances what its
      // air exchange carries away: a still tent builds up, fresh-air exchange (FAE) keeps it near room level.
      const productionLph = livingMushrooms.reduce((sum, m) => sum + getMushroomCo2Lph(m), 0);
      const exchangeM3PerHour = Math.max(0.04, fanFraction * 0.45) * 60 * tentVolM3;
      tCo2Target = roomCo2 + Math.min(4000, (productionLph / exchangeM3PerHour) * 1000); // L/m³ → ppm
    } else if (livingPlants.length > 0) {
      if (isDay) {
        // Daylight photosynthesis carbon assimilation:
        // Plants absorb CO2, but incoming room air continuously replenishes the canopy.
        // With active ventilation running, drawdown is realistically 20 to 40 PPM below room air.
        // Only a completely sealed unventilated tent (fan = 0%) can pull CO2 down near compensation point (~200 PPM).
        const healthyPlantsCount = livingPlants.filter(p => p.soilMoisture > 15 && p.health > 25).length;
        const lightIntensityFactor = Math.min(1.2, tLightPPFD / 750);
        
        let maxDrawdownPpm = 30;
        if (effectiveFanSpeed >= 50) {
          maxDrawdownPpm = 20 + healthyPlantsCount * 2.5; // ~25-35 PPM drawdown (e.g. 385-395 PPM when room is 420)
        } else if (effectiveFanSpeed >= 20) {
          maxDrawdownPpm = 35 + healthyPlantsCount * 4.0; // ~45-60 PPM drawdown
        } else if (effectiveFanSpeed > 0) {
          maxDrawdownPpm = 55 + healthyPlantsCount * 6.0; // ~65-85 PPM drawdown
        } else {
          maxDrawdownPpm = 210; // Sealed tent without ventilation draws down near compensation point
        }

        const plantDrawdown = Math.min(maxDrawdownPpm, maxDrawdownPpm * lightIntensityFactor);
        tCo2Target = Math.max(200, roomCo2 - plantDrawdown);
      } else {
        // Night respiration: plants gently release slight CO2 (+5 to 12 PPM above room air)
        tCo2Target = roomCo2 + Math.min(15, livingPlants.length * 2.5);
      }
    }

    // Account for occupants if inside tent
    let tentOccupantLitersPerHour = 0;
    tent.items.forEach(i => {
      if (i.category === 'person' || i.category === 'pet') {
        tentOccupantLitersPerHour += (i as any).co2RateLitersPerHour || 0;
      }
    });
    if (tentOccupantLitersPerHour > 0) {
      const occupantPpmBoost = (tentOccupantLitersPerHour * 20) / Math.max(0.2, fanFraction * 0.8 + 0.1);
      tCo2Target += Math.min(1200, occupantPpmBoost);
    }

    // Exponential approach toward steady-state equilibrium:
    // C(t) = C_target + (C_0 - C_target) * exp(-k * t)
    const kCo2Exchange = Math.max(0.04, fanFraction * 0.35 + 0.05);
    const co2DecayFraction = 1 - Math.exp(-kCo2Exchange * elapsedMinutes);
    tCo2 = tCo2 + (tCo2Target - tCo2) * co2DecayFraction;
    tCo2 = Math.max(200, Math.min(5000, Math.round(tCo2)));

    // Calculate enclosure photoperiod hours
    const activeGrowLight = arbitratedItems.find(i => i.category === 'equipment' && i.type === 'grow_light') as EquipmentItem | undefined;
    let enclosurePhotoperiodHours = 18;
    if (activeGrowLight?.schedule?.enabled) {
      const on = activeGrowLight.schedule.onHour;
      const off = activeGrowLight.schedule.offHour;
      enclosurePhotoperiodHours = off > on ? (off - on) : (24 - on + off);
    } else if (activeGrowLight && !activeGrowLight.powerOn) {
      enclosurePhotoperiodHours = 0;
    } else if (activeGrowLight && activeGrowLight.powerOn) {
      enclosurePhotoperiodHours = activeGrowLight.schedule?.disabledState === 'on' ? 24 : 0;
    }

    tTempF = Math.max(45, Math.min(115, parseFloat(tTempF.toFixed(1))));
    tRH = Math.max(15, Math.min(99, Math.round(tRH)));
    tCo2 = Math.max(200, Math.min(5000, Math.round(tCo2)));
    // The tent's exhausted air carries its CO2 (mushroom respiration, injection) into the room
    roomCo2 += airExchangeFraction * roomReturnShare * (tentVolCuFt / roomVolCuFt) * (tCo2 - roomCo2);
    const tTempC = parseFloat(fahrenheitToCelsius(tTempF).toFixed(1));
    const tVPD = calculateVPD(tTempF, tRH, tLightPPFD);

    // Update items inside tent (Plants & Mushrooms) using arbitrated equipment items
    const updatedItems = arbitratedItems.map(item => {
      return simulateCropItem({
        item,
        enclosureClimate: {
          tempF: tTempF,
          tempC: tTempC,
          rh: tRH,
          lightPPFD: tLightPPFD,
          vpdKpa: tVPD,
          co2Ppm: tCo2
        },
        photoperiodHours: enclosurePhotoperiodHours,
        elapsedMinutes,
        currentSimTime,
        events,
        room,
        outside,
        tentName: tent.name,
        rootHeat: getRootZoneHeat(item, tent.items, tent.id),
        enclosureItems: arbitratedItems
      });
    });

    return {
      ...tent,
      effectiveFanSpeed,
      controllerPriority: tentPriority,
      activeInterlocks,
      climate: {
        tempF: tTempF,
        tempC: tTempC,
        rh: tRH,
        lightPPFD: tLightPPFD,
        vpdKpa: tVPD,
        co2Ppm: tCo2
      },
      items: updatedItems
    };
  });

  // 3. UPDATE FREESTANDING ITEMS IN ROOM OR OUTDOOR GARDEN
  const updatedRoomItems = room.items.map(item => {
    const ducted = ductedArbitrated.get(item.id);
    if (ducted) return ducted;
    // Room heaters / A/Cs / registers: state from the room's thermostat loop
    const climateState = roomClimateUnitStates.get(item.id);
    if (climateState && item.category === 'equipment') {
      return { ...item, effectiveSetting: climateState.running ? item.setting : 0, interlockStatus: climateState.status };
    }
    // Room units aren't run by a tent controller; record what they actually did this tick
    const movedL = roomWaterL.get(item.id) ?? 0;
    const flowLph = movedL / Math.max(1e-6, elapsedMinutes / 60);
    if (item.category === 'equipment' && item.type === 'dehumidifier') {
      const running = movedL > 0;
      const filled = announceWaterLimits(item, {
        ...item,
        bucketLevelL: item.drainHoseConnected ? 0 : Math.min(getBucketCapacityL(item), getBucketLevelL(item) + movedL),
        waterFlowLph: flowLph
      }, room.name);
      return {
        ...filled,
        effectiveSetting: running ? item.setting : 0,
        interlockStatus: isBucketFull(filled) ? 'Bucket full: Empty collection bucket'
          : running ? `Dehumidifying: Extracting moisture to ${item.targetRh ?? 50}%`
          : item.powerOn ? 'Idle: Target reached' : 'Off'
      };
    }
    if (isHumidifier(item)) {
      const running = movedL > 0;
      const drained = announceWaterLimits(item, { ...item, reservoirLevelL: Math.max(0, getReservoirLevelL(item) - movedL), waterFlowLph: flowLph }, room.name);
      return {
        ...drained,
        reservoirTempF: stepReservoirTempF(drained, roomTempF, elapsedMinutes, room.items),
        effectiveSetting: running ? item.setting : 0,
        interlockStatus: isReservoirEmpty(drained) ? 'Out of water: Refill reservoir'
          : running ? `Misting: Raising RH to ${item.targetRh ?? 60}%`
          : item.powerOn ? 'Idle: Target reached' : 'Off'
      };
    }
    return simulateCropItem({
      item,
      enclosureClimate: {
        tempF: roomTempF,
        tempC: roomTempC,
        rh: roomRH,
        lightPPFD: roomLightPPFD,
        vpdKpa: roomVPD,
        co2Ppm: roomCo2
      },
      photoperiodHours: (() => {
        const rLight = room.items.find(i => i.category === 'equipment' && i.type === 'grow_light') as EquipmentItem | undefined;
        if (!rLight) return (isOutdoorGarden || isGreenhouse) ? 14 : 18;
        if (rLight.schedule?.enabled) {
          const on = rLight.schedule.onHour;
          const off = rLight.schedule.offHour;
          return off > on ? (off - on) : (24 - on + off);
        }
        if (!rLight.powerOn) return 0;
        return rLight.schedule?.disabledState === 'on' ? 24 : 0;
      })(),
      elapsedMinutes,
      currentSimTime,
      events,
      room,
      outside,
      tentName: isOutdoorGarden ? room.name : undefined,
      rootHeat: getRootZoneHeat(item, room.items),
      enclosureItems: room.items
    });
  });
  // Nutrient reservoirs flood / circulate to the plants and rack shelves they feed, on the floor or in any tent
  const [fedRoomItems, ...fedTentItems] = stepRoomNutrientReservoirs([
    { items: updatedRoomItems, ambientTempF: roomTempF, location: room.name },
    ...updatedTents.map(t => ({ items: t.items, ambientTempF: t.climate.tempF, location: t.name }))
  ], { simTime: currentSimTime, elapsedMinutes }, events);

  return {
    room: {
      ...room,
      climate: {
        tempF: roomTempF,
        tempC: roomTempC,
        // One decimal keeps small per-minute vapour flows (tent exhaust, single units) without long decimals in the UI
        rh: Math.round(roomRH * 10) / 10,
        lightPPFD: roomLightPPFD,
        vpdKpa: roomVPD,
        // One decimal: per-minute exchange with tents and outdoors is a fraction of a ppm
        co2Ppm: Math.round(Math.max(350, Math.min(5000, roomCo2)) * 10) / 10
      },
      tents: updatedTents.map((t, i) => ({ ...t, items: fedTentItems[i] })),
      items: fedRoomItems
    },
    events
  };
}

/**
 * Universal Crop Simulation Helper:
 * Evaluates soil dynamics, container volume buffering, medium drainage,
 * natural rainfall, microbial health, EC nutrient uptake, pH drift, and Hops lupulin accumulation.
 */
/**
 * CO2 a mushroom culture respires (L/h): a sealed ~60 L monotub reaching a few thousand ppm implies a
 * few tenths of a litre per hour. Most during colonization; scaled by container size and health.
 */
function getMushroomCo2Lph(shroom: MushroomItem): number {
  const base = shroom.containerType === 'monotub' ? 0.5 : shroom.containerType === 'grow_bag' ? 0.25 : 0.2;
  const stage = shroom.stage === 'colonizing' ? 1.3 : shroom.stage === 'mature' || shroom.stage === 'ready' ? 0.8 : 1.0;
  return base * stage * Math.max(0.2, shroom.health / 100);
}

/**
 * Colonization speed by substrate temperature, 1.0 at a typical 72°F room: peaks around 80°F,
 * crawls when cold and falls off sharply once the substrate overheats.
 */
function getColonizationWarmthFactor(substrateF: number): number {
  const points: Array<[number, number]> = [[50, 0.15], [60, 0.55], [72, 1.0], [80, 1.25], [86, 1.0], [92, 0.3]];
  if (substrateF <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x0, y0] = points[i - 1];
    if (substrateF <= x1) return y0 + ((substrateF - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}

function simulateCropItem(params: {
  item: any;
  enclosureClimate: { tempF: number; tempC: number; rh: number; lightPPFD: number; vpdKpa: number; co2Ppm: number };
  photoperiodHours: number;
  elapsedMinutes: number;
  currentSimTime: number;
  events: SimulationEvent[];
  room: Room;
  outside?: OutsideConditions;
  tentName?: string;
  rootHeat?: RootZoneHeat | null; // Heat mats under this pot / container (or under the tent's floor tray)
  enclosureItems?: any[];
}): any {
  const { item, enclosureClimate, photoperiodHours, elapsedMinutes, currentSimTime, events, room, outside, tentName, rootHeat = null, enclosureItems = [] } = params;

  if (item.category === 'plant') {
    const plant = { ...item } as PlantItem;
    const isDay = enclosureClimate.lightPPFD > 60;
    const isOutdoor = room.environmentType === 'outdoor_garden' || room.environmentType === 'greenhouse';

    // Check if plant is in a grow rack tray (with optional humidity dome, height elevation & heat conduction)
    const rackItem = plant.rackSlot ? enclosureItems.find(i => i.id === plant.rackSlot!.rackId) as EquipmentItem | undefined : undefined;
    const hasFloorHeatMat = enclosureItems.some(i => i.category === 'equipment' && i.type === 'heat_mat' && i.powerOn);
    const trayMicro = rackItem && plant.rackSlot ? calculateTrayMicroclimate({
      rack: rackItem,
      tierIndex: plant.rackSlot.tier,
      trayIndex: plant.rackSlot.tray,
      ambientClimate: enclosureClimate,
      floorHeatMatActive: hasFloorHeatMat,
      overheadLightPpfd: enclosureClimate.lightPPFD,
      plantStage: plant.stage,
      hasWetMedia: isTrayWet(rackItem, enclosureItems, plant.rackSlot.tier, plant.rackSlot.tray),
      simTime: currentSimTime
    }) : undefined;

    const cropClimate = trayMicro ? {
      ...enclosureClimate,
      tempF: trayMicro.tempF,
      tempC: parseFloat(fahrenheitToCelsius(trayMicro.tempF).toFixed(1)),
      rh: trayMicro.rh,
      vpdKpa: trayMicro.vpdKpa,
      lightPPFD: trayMicro.lightPPFD
    } : enclosureClimate;

    // Ensure keyDates exists
    if (!plant.keyDates) {
      plant.keyDates = {
        plantedDate: currentSimTime - (plant.ageDays || 1) * 86400000
      };
      if (plant.stage !== 'germination' && plant.stage !== 'rooting') {
        plant.keyDates.sproutedDate = currentSimTime - Math.max(1, (plant.ageDays - 5)) * 86400000;
        plant.keyDates.seedlingDate = currentSimTime - Math.max(1, (plant.ageDays - 5)) * 86400000;
      }
      if (plant.stage === 'mature_seedling' || plant.stage === 'vegetative' || plant.stage === 'flowering' || plant.stage === 'ripening' || plant.stage === 'ready') {
        plant.keyDates.matureSeedlingDate = currentSimTime - Math.max(1, (plant.ageDays - 12)) * 86400000;
      }
      if (plant.stage === 'vegetative' || plant.stage === 'flowering' || plant.stage === 'ripening' || plant.stage === 'ready') {
        plant.keyDates.vegetativeDate = currentSimTime - Math.max(1, (plant.ageDays - 20)) * 86400000;
      }
      if (plant.stage === 'flowering' || plant.stage === 'ripening' || plant.stage === 'ready') {
        plant.keyDates.floweringDate = currentSimTime - Math.max(1, (plant.ageDays - 35)) * 86400000;
      }
      if (plant.stage === 'ripening' || plant.stage === 'ready') {
        plant.keyDates.ripeningDate = currentSimTime - Math.max(1, (plant.ageDays - 50)) * 86400000;
      }
      if (plant.stage === 'ready') {
        plant.keyDates.readyDate = currentSimTime - 86400000;
      }
    }

    // Ensure seed/cutting genetic traits exist
    if (!plant.traits) {
      plant.traits = generateSeedTraits(plant.species, plant.strainName, plant.propagationType);
      if (plant.stage !== 'germination' && plant.stage !== 'rooting') {
        plant.traits.germinationOutcome = 'germinated';
      }
    }

    // A. Root Zone Temperature Simulation
    let targetRootTemp = isOutdoor ? cropClimate.tempF * 0.82 + 12.0 : cropClimate.tempF * 0.75 + 16.0;
    targetRootTemp = applyRootZoneHeat(targetRootTemp, rootHeat);
    // If on a grow rack, add conducted bottom heat from tier position
    if (trayMicro?.conductedMatHeatF && !rootHeat) {
      targetRootTemp += trayMicro.conductedMatHeatF * 0.65;
    }
    const currentRoot = plant.rootTempF || targetRootTemp;
    // Not rounded: per-minute changes are smaller than 0.1° and would otherwise be lost
    plant.rootTempF = currentRoot + (targetRootTemp - currentRoot) * Math.min(1, 0.05 * (elapsedMinutes / 10));

    // B. Soil & Medium Dynamics:
    // Water use follows the plant: transpiration scales with its canopy (leaf area), how hard the air
    // pulls (VPD) and whether the lights are on, plus a little evaporation off the pot's surface. The
    // moisture drop is that water against what the root zone holds, so a big plant in a small pot dries
    // within a day or two while a seedling barely dents a 5 gal pot. Roughly 2.5 L/day for a 30" canopy
    // at ~1 kPa VPD; a 72-cell seedling ~0.04 L/day.
    // Under a humidity dome, evaporation is suppressed to 15% (closed) or 35% (vented), conserving moisture!
    const volGallons = plant.containerVolumeGallons || getDefaultContainerVolumeGallons(plant.containerType);
    const canopyIn = Math.max(0.5, plant.canopyWidthInches || 0);
    const transpirationLPerDay = 0.015 * Math.pow(canopyIn, 1.5)
      * Math.max(0.4, Math.min(1.8, cropClimate.vpdKpa || 1))
      * (isDay ? 1.3 : 0.35);
    const potSurfaceSqFt = plant.containerDimensions ? plant.containerDimensions.length * plant.containerDimensions.width : 0.8;
    const evapMultiplier = trayMicro ? trayMicro.soilMoistureEvapMultiplier : 1.0;
    const evaporationLPerDay = 0.1 * potSurfaceSqFt * evapMultiplier;
    // A DWC bucket's roots hang in its own water: the medium barely dries
    const dwcFactor = plant.systemType === 'dwc' ? 0.05 : 1;
    const waterUsedL = (transpirationLPerDay + evaporationLPerDay) * dwcFactor * (elapsedMinutes / 1440);
    const moistureConsumed = (waterUsedL / getRootZoneWaterL({ ...plant, containerVolumeGallons: volGallons })) * 100;
    // Not rounded: at 1x a minute's drying is well under 0.01% and would be rounded away
    plant.soilMoisture = Math.max(0, plant.soilMoisture - moistureConsumed);

    // Rain hydration for outdoor gardens
    if (isOutdoor && outside?.weather === 'rainy') {
      const rainHydration = (room.environmentType === 'outdoor_garden' ? 0.45 : 0.08) * (elapsedMinutes / 10);
      plant.soilMoisture = Math.min(100, parseFloat((plant.soilMoisture + rainHydration).toFixed(1)));
    }

    // Soil pH drift & microbial buffering
    const elapsedDays = elapsedMinutes / (60 * 24);
    if (plant.soilPh === undefined) {
      plant.soilPh = plant.systemType === 'dwc' || plant.systemType === 'ebb_and_flow' ? 5.8 : 6.4;
    }
    if (plant.systemType === 'dwc' || plant.systemType === 'ebb_and_flow') {
      plant.soilPh = parseFloat(Math.min(7.2, plant.soilPh + 0.015 * elapsedDays).toFixed(2));
    } else if (plant.growingMedium === 'living_organic_soil') {
      const drift = (6.5 - plant.soilPh) * 0.06 * elapsedDays;
      plant.soilPh = parseFloat((plant.soilPh + drift).toFixed(2));
    }

    // EC / Nutrient consumption
    if (plant.ecTdsPpm === undefined) {
      plant.ecTdsPpm = plant.stage === 'seedling' ? 450 : plant.stage === 'vegetative' ? 1100 : 1350;
    }
    if (plant.stageProgress > 0 && !plant.isHarvested) {
      const dailyConsumption = plant.stage === 'vegetative' ? 16 : plant.stage === 'flowering' ? 24 : 8;
      plant.ecTdsPpm = Math.max(120, Math.round(plant.ecTdsPpm - dailyConsumption * elapsedDays));
    }

    // Aeration & Microbial Colony initialization
    if (plant.microbialHealth === undefined) {
      plant.microbialHealth = plant.growingMedium === 'living_organic_soil' ? 95 : plant.growingMedium === 'coco_perlite' ? 45 : 30;
    }
    if (plant.aerationOxygenPct === undefined) {
      plant.aerationOxygenPct = plant.systemType === 'dwc' ? 96 : plant.containerType === 'fabric_pot' ? 88 : 72;
    }

    // Hops Alpha Acid Accumulation
    if (plant.species === 'Hops') {
      let maxAA = 6.5;
      const sLower = (plant.strainName || '').toLowerCase();
      if (sLower.includes('citra')) maxAA = 12.8;
      else if (sLower.includes('chinook')) maxAA = 13.5;
      else if (sLower.includes('centennial')) maxAA = 10.8;
      else if (sLower.includes('saaz')) maxAA = 3.9;
      else if (sLower.includes('amarillo')) maxAA = 9.8;
      else maxAA = 6.2; // Cascade

      if (plant.alphaAcidsPct === undefined) {
        plant.alphaAcidsPct = plant.stage === 'flowering' ? maxAA * 0.5 : plant.stage === 'ripening' || plant.stage === 'ready' ? maxAA : 0.5;
      } else if (plant.stage === 'flowering' || plant.stage === 'ripening') {
        plant.alphaAcidsPct = Math.min(maxAA, parseFloat((plant.alphaAcidsPct + 0.12 * elapsedDays).toFixed(1)));
      }
    }

    // C. Stage Suitability & Stress Assessment (with Tray Dome Microclimate)
    const stageSuitability = evaluatePlantStageSuitability(
      plant,
      cropClimate,
      plant.rootTempF,
      photoperiodHours,
      trayMicro ? {
        domed: trayMicro.hasDome,
        vented: trayMicro.ventsOpen,
        trappedHeatF: trayMicro.tempF - enclosureClimate.tempF
      } : undefined
    );

    // Occasional events for tray dome dangers
    if (trayMicro?.isOverheating && Math.random() < 0.04) {
      events.push({
        type: 'warning',
        category: 'crop',
        tentName,
        title: `🔥 Dome Overheating: ${plant.name}`,
        message: trayMicro.warning || `Interior dome temperature reached ${trayMicro.tempF}°F. Open vents or dim lights.`
      });
    } else if (trayMicro?.isDampingOffRisk && Math.random() < 0.04) {
      events.push({
        type: 'warning',
        category: 'crop',
        tentName,
        title: `⚠️ Damping-Off Risk: ${plant.name}`,
        message: trayMicro.warning || `Seedling under closed dome in high humidity. Crack dome vents open or remove dome.`
      });
    }

    let healthDelta = 0;
    if (plant.soilMoisture < 15) {
      healthDelta -= 0.25 * (elapsedMinutes / 60);
    } else if (plant.soilMoisture > 92 && plant.systemType !== 'dwc') {
      healthDelta -= 0.15 * (elapsedMinutes / 60);
    }

    if (plant.rootTempF < 58) {
      healthDelta -= 0.1 * (elapsedMinutes / 60);
    } else if (plant.rootTempF > 78) {
      healthDelta -= 0.15 * (elapsedMinutes / 60);
    }

    if (cropClimate.vpdKpa > 1.8) {
      healthDelta -= 0.2 * (elapsedMinutes / 60);
    } else if (cropClimate.vpdKpa < 0.35) {
      healthDelta -= 0.08 * (elapsedMinutes / 60);
    } else if (cropClimate.vpdKpa >= 0.8 && cropClimate.vpdKpa <= 1.4 && plant.soilMoisture > 40 && plant.soilMoisture < 80) {
      healthDelta += 0.25 * (elapsedMinutes / 60);
    }

    if (trayMicro?.isDampingOffRisk) {
      healthDelta -= 0.25 * (elapsedMinutes / 60);
    }
    if (trayMicro?.isOverheating) {
      healthDelta -= 0.30 * (elapsedMinutes / 60);
    }

    if (stageSuitability.status === 'optimal') {
      healthDelta += 0.12 * (elapsedMinutes / 60);
    } else if (stageSuitability.status === 'critical') {
      healthDelta -= 0.3 * (elapsedMinutes / 60);
    }

    plant.health = Math.max(0, Math.min(100, parseFloat((plant.health + healthDelta).toFixed(1))));
    plant.ageDays = parseFloat((plant.ageDays + elapsedDays).toFixed(2));
    plant.currentStageDays = parseFloat(((plant.currentStageDays || 0) + elapsedDays).toFixed(2));

    // D. Growth Progress & Cultivar Milestone Progression
    if (plant.health > 25 && !plant.isHarvested) {
      // Evaluate Germination Viability and Failure Risk for seeds
      if (plant.stage === 'germination') {
        const traits = plant.traits;
        if (traits) {
          traits.daysInGermination = parseFloat(((traits.daysInGermination || 0) + elapsedDays).toFixed(2));
          const expectedGermDays = plant.germinationDaysExpected || 5;

          // If germination is taking longer than expected under sub-optimal conditions:
          if (traits.daysInGermination > expectedGermDays * 2.0 && plant.stageProgress < 65) {
            let effectiveViability = traits.viabilityPct;
            const isChilled = (plant.rootTempF || 70) < 68;
            const isMoistureExtreme = plant.soilMoisture < 25 || plant.soilMoisture > 92;

            if (plant.rootTempF >= 78 && plant.rootTempF <= 86) effectiveViability += 10; // Heat mat boost!
            if (isChilled) effectiveViability -= 25;
            if (isMoistureExtreme) effectiveViability -= 25;

            if (effectiveViability < 55 && traits.germinationOutcome !== 'failed') {
              traits.germinationOutcome = 'failed';
              traits.failureReason = isChilled 
                ? 'Embryo failed to emerge due to cold root zone (<68°F) and low seed viability.'
                : isMoistureExtreme
                  ? 'Seed rotted / suffered damping-off from improper moisture balance.'
                  : 'Low viability seed coat failed to crack.';
              events.push({
                type: 'warning',
                category: 'crop',
                tentName,
                title: `⚠️ Germination Stalled: ${plant.name}`,
                message: `${traits.failureReason} Open properties dialog to inspect traits or re-seed.`
              });
            } else if (traits.germinationOutcome !== 'failed') {
              traits.germinationOutcome = 'dormant';
            }
          }
        }
      }

      let co2Multiplier = 1.0;
      if (isDay && enclosureClimate.lightPPFD > 500) {
        if (enclosureClimate.co2Ppm >= 1000 && enclosureClimate.co2Ppm <= 1500) {
          co2Multiplier = 1.25;
        } else if (enclosureClimate.co2Ppm < 350) {
          co2Multiplier = 0.65;
        }
      }

      let expectedDays = DEFAULT_STAGE_DURATIONS[plant.stage] || 30;
      if (plant.stage === 'germination' && plant.germinationDaysExpected) expectedDays = plant.germinationDaysExpected;
      else if (plant.stage === 'rooting' && plant.rootingDaysExpected) expectedDays = plant.rootingDaysExpected;
      else if (plant.stage === 'seedling' && plant.seedlingDaysExpected) expectedDays = plant.seedlingDaysExpected;
      else if (plant.stage === 'mature_seedling' && plant.matureSeedlingDaysExpected) expectedDays = plant.matureSeedlingDaysExpected;
      else if (plant.stage === 'vegetative' && plant.vegetativeDaysExpected) expectedDays = plant.vegetativeDaysExpected;
      else if (plant.stage === 'flowering' && plant.floweringDaysExpected) expectedDays = plant.floweringDaysExpected;
      else if (plant.stage === 'ripening' && plant.ripeningDaysExpected) expectedDays = plant.ripeningDaysExpected;
      else if (plant.species === 'Chili Pepper') {
        const pepperCult = getPepperCultivar(plant.strainName || plant.name);
        if (pepperCult) {
          if (plant.stage === 'germination') expectedDays = pepperCult.germinationDaysExpected;
          else if (plant.stage === 'seedling') expectedDays = pepperCult.seedlingDaysExpected;
          else if (plant.stage === 'mature_seedling') expectedDays = pepperCult.matureSeedlingDaysExpected;
          else if (plant.stage === 'vegetative') expectedDays = pepperCult.vegetativeDaysExpected;
          else if (plant.stage === 'flowering') expectedDays = pepperCult.floweringDaysExpected;
          else if (plant.stage === 'ripening') expectedDays = pepperCult.ripeningDaysExpected;
        }
      }

      // Genetic vigor multipliers:
      const germinationVigor = plant.traits?.germinationVigor || 1.0;
      const growthRateMultiplier = plant.traits?.growthRateMultiplier || 1.0;
      const stageSpeedMultiplier = plant.stage === 'germination' ? germinationVigor : growthRateMultiplier;

      const baseDailyPercent = 100 / Math.max(1, expectedDays);
      
      // If seed has failed to germinate, progress is 0
      const isFailedGerm = plant.stage === 'germination' && plant.traits?.germinationOutcome === 'failed';
      const progressDelta = isFailedGerm ? 0 : (
        baseDailyPercent * elapsedDays * stageSuitability.overallScore * (plant.health / 100) * 
        (isDay || plant.stage === 'germination' || plant.stage === 'rooting' ? 1.0 : 0.4) * 
        co2Multiplier * stageSpeedMultiplier
      );
      plant.stageProgress = Math.min(100, plant.stageProgress + progressDelta);

      if (plant.stageProgress >= 100 && plant.stage !== 'ready') {
        plant.stageProgress = 0;
        plant.currentStageDays = 0;
        const previousStage = plant.stage;
        const nextStage = getNextPlantStage(plant.stage, plant.propagationType || 'seed');
        plant.stage = nextStage;

        if (previousStage === 'germination') {
          if (plant.traits) {
            plant.traits.germinationOutcome = 'germinated';
          }
          plant.keyDates.sproutedDate = currentSimTime;
          plant.keyDates.seedlingDate = currentSimTime;
          events.push({
            type: 'info',
            category: 'crop',
            tentName,
            title: `🌱 Seed Sprouted: ${plant.name}`,
            message: `${plant.name} has successfully cracked its seed coat and emerged! Vigorous seedling stage initiated.`
          });
        } else if (previousStage === 'rooting') {
          if (plant.traits) {
            plant.traits.germinationOutcome = 'germinated';
          }
          plant.keyDates.rootedDate = currentSimTime;
          plant.keyDates.seedlingDate = currentSimTime;
          events.push({
            type: 'info',
            category: 'crop',
            tentName,
            title: `🌱 Clone Rooted: ${plant.name}`,
            message: `${plant.name} cutting has struck vigorous roots! Entered Seedling stage.`
          });
        } else if (previousStage === 'seedling') {
          plant.keyDates.matureSeedlingDate = currentSimTime;
          events.push({
            type: 'info',
            category: 'crop',
            tentName,
            title: `🌿 Mature Seedling: ${plant.name}`,
            message: `${plant.name} has established multiple leaf sets. Entered Mature Seedling stage.`
          });
        } else if (previousStage === 'mature_seedling') {
          plant.keyDates.vegetativeDate = currentSimTime;
          events.push({
            type: 'info',
            category: 'crop',
            tentName,
            title: `🌿 Vegetative Growth: ${plant.name}`,
            message: `${plant.name} is now in rapid vegetative growth canopy expansion.`
          });
        } else if (previousStage === 'vegetative') {
          plant.keyDates.floweringDate = currentSimTime;
          events.push({
            type: 'info',
            category: 'crop',
            tentName,
            title: `🌸 Flowering Transition: ${plant.name}`,
            message: `${plant.name} has initiated flowering! Calyx and cone formation underway.`
          });
        } else if (previousStage === 'flowering') {
          plant.keyDates.ripeningDate = currentSimTime;
          events.push({
            type: 'info',
            category: 'crop',
            tentName,
            title: `✨ Ripening Stage: ${plant.name}`,
            message: `${plant.name} entering late ripen phase. Aromatics, essential oils, and resins peaking.`
          });
        } else if (previousStage === 'ripening') {
          plant.keyDates.readyDate = currentSimTime;
          events.push({
            type: 'success',
            category: 'crop',
            tentName,
            title: `🏆 Ready for Harvest: ${plant.name}`,
            message: `${plant.name} has reached peak maturity. Ready to harvest!`
          });
        }
      }

      // Size: grow toward the species' size for the current stage progress (scaled by root-zone
      // volume), easing in over ~a day so stage changes and older saves don't jump. Never shrinks.
      const target = getPlantTargetSize(plant, getContainerSizeFactor(volGallons));
      const approach = 1 - Math.exp(-1.5 * elapsedDays);
      plant.heightInches = Math.max(plant.heightInches, plant.heightInches + (target.heightInches - plant.heightInches) * approach);
      plant.canopyWidthInches = Math.max(plant.canopyWidthInches, plant.canopyWidthInches + (target.canopyWidthInches - plant.canopyWidthInches) * approach);

      // Yield scaling with genetic multiplier
      if (plant.stage === 'flowering' || plant.stage === 'ripening') {
        const yieldMult = plant.traits?.yieldMultiplier || 1.0;
        const maxYield = (plant.species === 'Hops' ? 450 : 380) * yieldMult;
        plant.yieldPotentialGrams = Math.min(maxYield, plant.yieldPotentialGrams + 0.22 * progressDelta * yieldMult);
      }
    }

    return syncItemGeometry(plant);
  } else if (item.category === 'mushroom') {
    const shroom = { ...item } as MushroomItem;

    // Ensure mushroom spore genetic traits exist
    if (!shroom.traits) {
      shroom.traits = generateSporeTraits(shroom.species, shroom.strainName);
      if (shroom.stage !== 'colonizing') {
        shroom.traits.sporeViabilityOutcome = 'germinated';
      }
    }

    let healthDelta = 0;
    if (enclosureClimate.rh < 70) {
      healthDelta -= 0.35 * (elapsedMinutes / 60);
    } else if (enclosureClimate.rh >= 85) {
      healthDelta += 0.25 * (elapsedMinutes / 60);
    }

    if (shroom.stage === 'fruiting' || shroom.stage === 'pinning') {
      const co2Limit = 1300 * (shroom.traits?.co2Tolerance || 1.0);
      if (enclosureClimate.co2Ppm > co2Limit) {
        healthDelta -= 0.15 * (elapsedMinutes / 60);
      }
    }

    // Substrate follows the air (plus any heat mat underneath) with a few hours of thermal lag
    const targetSubstrateF = applyRootZoneHeat(enclosureClimate.tempF, rootHeat);
    const currentSubstrateF = shroom.substrateTempF ?? targetSubstrateF;
    shroom.substrateTempF = currentSubstrateF + (targetSubstrateF - currentSubstrateF) * (1 - Math.exp(-elapsedMinutes / 180));
    if (shroom.substrateTempF > 88) {
      // Overheated substrate stresses (and eventually cooks) the mycelium
      healthDelta -= 0.4 * (elapsedMinutes / 60);
    }

    const loss = 0.03 * (elapsedMinutes / 60);
    shroom.substrateMoisture = Math.max(0, parseFloat((shroom.substrateMoisture - loss).toFixed(2)));
    if (shroom.substrateMoisture < 40) {
      healthDelta -= 0.25 * (elapsedMinutes / 60);
    }

    // Contamination resistance buffering
    if (healthDelta < 0 && shroom.traits?.contaminationResistance === 'impervious') {
      healthDelta *= 0.5;
    } else if (healthDelta < 0 && shroom.traits?.contaminationResistance === 'vulnerable') {
      healthDelta *= 1.35;
    }

    shroom.health = Math.max(0, Math.min(100, parseFloat((shroom.health + healthDelta).toFixed(1))));

    // Colonization tracking
    if (shroom.stage === 'colonizing') {
      shroom.traits.daysInColonization = parseFloat(((shroom.traits.daysInColonization || 0) + (elapsedMinutes / (60 * 24))).toFixed(2));
      if (shroom.substrateMoisture < 25 && shroom.traits.viabilityPct < 70) {
        shroom.traits.sporeViabilityOutcome = 'failed';
        shroom.traits.failureReason = 'Substrate dried out and spores failed to produce hyphae.';
      }
    }

    if (shroom.health > 35 && !shroom.isHarvested && shroom.traits?.sporeViabilityOutcome !== 'failed') {
      const vigorMult = shroom.traits?.colonizationVigor || 1.0;
      // Mycelium runs fastest on warm substrate; fruiting isn't temperature-limited here
      const warmthMult = shroom.stage === 'colonizing' ? getColonizationWarmthFactor(shroom.substrateTempF ?? enclosureClimate.tempF) : 1;
      const shroomProgressRate = (shroom.health / 100) * (elapsedMinutes / (60 * 24)) * vigorMult * warmthMult;
      shroom.ageDays = parseFloat((shroom.ageDays + elapsedMinutes / (60 * 24)).toFixed(2));
      shroom.stageProgress = Math.min(100, shroom.stageProgress + shroomProgressRate * 14);

      if (shroom.stage === 'colonizing') {
        shroom.myceliumColonization = Math.min(100, parseFloat((shroom.myceliumColonization + shroomProgressRate * 15).toFixed(1)));
      }

      if (shroom.stageProgress >= 100) {
        shroom.stageProgress = 0;
        const prevShroomStage = shroom.stage;
        if (prevShroomStage === 'colonizing') {
          shroom.stage = 'pinning';
          shroom.traits.sporeViabilityOutcome = 'germinated';
          events.push({
            type: 'info',
            category: 'crop',
            tentName,
            title: `🍄 Primordia Pinning: ${shroom.name}`,
            message: `Tiny pinhead primordia (${shroom.traits.pinningDensity} density) emerging from colonized substrate! Maintain high RH.`
          });
        } else if (prevShroomStage === 'pinning') {
          shroom.stage = 'fruiting';
          events.push({
            type: 'info',
            category: 'crop',
            tentName,
            title: `🍄 Fruiting Flush: ${shroom.name}`,
            message: `Pins are rapidly expanding into clustered fruiting caps! Ensure adequate fresh air exchange.`
          });
        } else if (prevShroomStage === 'fruiting') {
          shroom.stage = 'mature';
          events.push({
            type: 'info',
            category: 'crop',
            tentName,
            title: `🍄 Mature Caps: ${shroom.name}`,
            message: `Veils are stretching and caps are uncurling. Spore drop imminent.`
          });
        } else if (prevShroomStage === 'mature') {
          shroom.stage = 'ready';
          events.push({
            type: 'success',
            category: 'crop',
            tentName,
            title: `🏆 Ready for Harvest: ${shroom.name}`,
            message: `${shroom.name} has reached maximum prime flush density. Harvest before heavy spore drop!`
          });
        }
      }

      if (shroom.stage === 'fruiting' || shroom.stage === 'mature') {
        const flushMult = shroom.traits?.flushYieldMultiplier || 1.0;
        shroom.yieldPotentialGrams = Math.min(480 * flushMult, shroom.yieldPotentialGrams + 0.3 * (elapsedMinutes / 60) * flushMult);
      }
    }

    return syncItemGeometry(shroom);
  }

  return item;
}
