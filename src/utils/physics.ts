import { Climate, OutsideConditions, PlantItem, MushroomItem, EquipmentItem, PersonItem, PetItem, Room, Tent, ControllerPriority, JournalCategory } from '../types/sim';
import { evaluatePlantStageSuitability, getNextPlantStage, DEFAULT_STAGE_DURATIONS, getPepperCultivar, getPlantTargetSize, getContainerSizeFactor } from './plantLifecycle';
import { syncItemGeometry, getDefaultContainerVolumeGallons } from './spatial';
import { getDuctTargetTent, getDuctedHumidifiersForTent, getMistWaterEffects, isHumidifier, stepReservoirTempF, HOSE_DELIVERY_EFFICIENCY } from './humidifierDucting';
import { generateSeedTraits, generateSporeTraits } from './genetics';

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
export function isLightScheduledOn(hour: number, schedule?: { enabled: boolean; onHour: number; offHour: number }): boolean {
  if (!schedule || !schedule.enabled) return true;
  const { onHour, offHour } = schedule;
  if (onHour < offHour) {
    return hour >= onHour && hour < offHour;
  } else {
    // Overnight schedule e.g. 18:00 to 06:00
    return hour >= onHour || hour < offHour;
  }
}

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
  heatMatActive: boolean;
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
  let heatMatActive = false;

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
      if (item.type === 'humidifier' && item.powerOn) {
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
      } else if (item.type === 'dehumidifier' && item.powerOn) {
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
      } else if (item.type === 'heat_mat' && item.powerOn) {
        heatMatActive = true;
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
        eq.interlockStatus = eq.schedule?.enabled ? 'On (Scheduled photoperiod)' : 'On (Continuous)';
      } else {
        eq.effectiveSetting = 0;
        eq.interlockStatus = 'Off (Night cycle by schedule)';
      }
      return eq;
    }

    // B. HUMIDIFIERS
    if (eq.type === 'humidifier') {
      const target = eq.targetRh ?? eq.setting ?? (isShroomEnclosure ? 90 : 60);
      if (humidifierSuppressed) {
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
      if (dehumidifierSuppressed) {
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
      const minSpeed = triggers.minSpeedPercent ?? (isShroomEnclosure ? 0 : 0);
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
    lightPPFD,
    heatMatActive
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
  let roomLightPPFD = 10;
  const hvacMode = room.hvacMode || 'central_ac_active';
  const coolingSetpoint = room.hvacCoolingSetpointF || 72.0;
  const heatingSetpoint = room.hvacHeatingSetpointF || 68.0;

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
    // Indoor conditioned living space (conduction, infiltration, central HVAC)
    const uValue = 1 / Math.max(1, rValue);
    const wallHeatGainRate = (uValue * wallAreaSqFt * (outside.tempF - roomTempF)) / (roomVolCuFt * 1.08);
    const deltaTConduction = (wallHeatGainRate * (elapsedMinutes / 60));
    roomTempF += deltaTConduction * 0.4;

    const airExchangeRatePerHour = ach;
    const infiltrationFraction = Math.min(0.5, (airExchangeRatePerHour * (elapsedMinutes / 60)));
    roomTempF += (outside.tempF - roomTempF) * infiltrationFraction;
    roomRH += (outside.rh - roomRH) * infiltrationFraction * 0.3;
    roomCo2 += (outside.co2Ppm - roomCo2) * infiltrationFraction;

    if (hvacMode === 'central_ac_active') {
      if (roomTempF > coolingSetpoint) {
        const coolDelta = Math.min(roomTempF - coolingSetpoint, 0.08 * (elapsedMinutes / 5));
        roomTempF -= coolDelta;
        if (roomRH > 55) {
          roomRH = Math.max(48, roomRH - 0.05 * (elapsedMinutes / 5));
        }
      }
    } else if (hvacMode === 'heating_active') {
      if (roomTempF < heatingSetpoint) {
        const heatDelta = Math.min(heatingSetpoint - roomTempF, 0.08 * (elapsedMinutes / 5));
        roomTempF += heatDelta;
      }
    }

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

    if (roomOccupantHeatWatts > 0) {
      const occupantHeatGainRate = (roomOccupantHeatWatts * 3.412) / (roomVolCuFt * 1.08);
      roomTempF += occupantHeatGainRate * (elapsedMinutes / 60) * 0.35;
    }

    if (roomOccupantMoistureLitersPerDay > 0) {
      const moistureGrams = (roomOccupantMoistureLitersPerDay * 1000 / 1440) * elapsedMinutes;
      const rhDelta = (moistureGrams / (roomVolCuFt * 0.03)) * 0.01;
      roomRH = Math.min(95, roomRH + rhDelta);
    }

    // Equipment in the main room
    room.items.forEach(item => {
      if (item.category === 'equipment' && item.powerOn) {
        if (item.type === 'heater') {
          const target = item.targetTempF ?? 74;
          if (roomTempF < target) {
            roomTempF += 0.06 * (item.setting / 100) * (elapsedMinutes / 10);
          }
        } else if (item.type === 'dehumidifier') {
          const target = item.targetRh ?? 50;
          if (roomRH > target) {
            roomRH = Math.max(target, roomRH - 0.25 * (item.setting / 100) * (elapsedMinutes / 10));
          }
        } else if (item.type === 'humidifier') {
          // Hose-ducted units mist into their tent instead (handled in the tent loop)
          if (getDuctTargetTent(room, item)) return;
          const target = item.targetRh ?? 60;
          if (roomRH < target) {
            const { outputFactor } = getMistWaterEffects(item.reservoirTempF ?? roomTempF, roomTempF);
            roomRH = Math.min(target, roomRH + 0.35 * (item.setting / 100) * outputFactor * (elapsedMinutes / 10));
          }
        } else if (item.type === 'co2_regulator') {
          const targetCo2 = item.targetCo2Ppm ?? 1000;
          if (roomCo2 < targetCo2) {
            roomCo2 = Math.min(targetCo2, roomCo2 + 15 * (item.setting / 100) * (elapsedMinutes / 5));
          }
        }
      }
    });

    roomTempF = Math.max(50, Math.min(105, parseFloat(roomTempF.toFixed(1))));
    roomRH = Math.max(20, Math.min(95, Math.round(roomRH)));
    roomCo2 = Math.max(350, Math.min(3000, Math.round(roomCo2)));
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

    // Reservoirs drift toward the air around the unit: tent air in here, room air for hose-ducted units
    const withReservoir = (item: Tent['items'][number], ambientF: number) =>
      isHumidifier(item) ? { ...item, reservoirTempF: stepReservoirTempF(item, ambientF, elapsedMinutes) } : item;
    const ductedHumidifiers = getDuctedHumidifiersForTent(room, tent.id).map(i => withReservoir(i, roomTempF));
    const ductedIds = new Set(ductedHumidifiers.map(i => i.id));

    const arbitration = arbitrateEnclosureEquipment({
      items: [...tent.items.map(i => withReservoir(i, tTempF)), ...ductedHumidifiers],
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
      lightPPFD: tLightPPFD,
      heatMatActive
    } = arbitration;

    // Hose-ducted units live in room.items; pull them back out of this tent's item list
    const arbitratedItems = allArbitratedItems.filter(item => {
      if (!ductedIds.has(item.id)) return true;
      const eq = item as EquipmentItem;
      ductedArbitrated.set(eq.id, { ...eq, interlockStatus: `${eq.interlockStatus} → hose into ${tent.name}` });
      return false;
    });

    // Check biological occupants in tent
    arbitratedItems.forEach(item => {
      if (item.category === 'person' || item.category === 'pet') {
        const tentVolLiters = tentVolCuFt * 28.3168;
        const emittedLiters = (item as any).co2RateLitersPerHour * (elapsedMinutes / 60);
        tCo2 += (emittedLiters / tentVolLiters) * 1_000_000;
        tRH = Math.min(99, tRH + 0.1 * (elapsedMinutes / 5));
      }
    });

    // 1. Heat addition from grow lights
    const lightHeatDelta = (totalHeatWatts / Math.max(40, tentVolCuFt)) * 0.022 * (elapsedMinutes / 5);
    tTempF += lightHeatDelta;

    // 2. Heat conduction through Mylar tent fabric with Host Room air:
    const tentSurfaceArea = 2 * (tent.dimensions.length * tent.dimensions.height + tent.dimensions.width * tent.dimensions.height) + tentAreaSqFt;
    const fabricConductionRate = (1.4 * tentSurfaceArea * (roomTempF - tTempF)) / (tentVolCuFt * 1.08);
    tTempF += (fabricConductionRate * (elapsedMinutes / 60)) * 0.25;

    // 3. Ventilation & Air Exchange with Host Lung Room:
    // Use arbitrated effectiveFanSpeed (respects humidifier lockout & auto triggers!)
    const fanFraction = effectiveFanSpeed / 100;
    const airExchangeFraction = Math.min(0.95, 1 - Math.exp(-Math.max(0.04, fanFraction * 0.45) * elapsedMinutes));
    tTempF += (roomTempF - tTempF) * airExchangeFraction;

    // Relative Humidity dynamics:
    if (activeHumidifierTarget !== null && activeHumidifierCapacity > 0) {
      // Sonic fogger saturation
      const exhaustDamping = 1 / (1 + fanFraction * 0.12);
      const steadyStateRH = Math.max(roomRH, activeHumidifierTarget * exhaustDamping);

      if (tRH < steadyStateRH) {
        const humidifyFraction = 1 - Math.exp(-Math.max(0.4, activeHumidifierCapacity * 0.6) * elapsedMinutes);
        tRH = tRH + (steadyStateRH - tRH) * humidifyFraction;
        tTempF -= activeHumidifierCoolingPerCapacity * (elapsedMinutes / 5) * activeHumidifierCapacity;
      } else if (tRH > activeHumidifierTarget) {
        tRH += (roomRH - tRH) * airExchangeFraction;
      }
    } else if (activeDehumidifierTarget !== null && activeDehumidifierCapacity > 0) {
      if (tRH > activeDehumidifierTarget) {
        const dehumFraction = 1 - Math.exp(-Math.max(0.25, activeDehumidifierCapacity * 0.4) * elapsedMinutes);
        tRH = tRH + (activeDehumidifierTarget - tRH) * dehumFraction;
        tTempF += 0.06 * (elapsedMinutes / 5) * activeDehumidifierCapacity; // Compressor heat
      } else {
        tRH += (roomRH - tRH) * airExchangeFraction;
      }
    } else {
      // Passive ventilation only
      tRH += (roomRH - tRH) * airExchangeFraction;
    }

    // Heat & humidity return to lung room (discharge into the host room)
    const exhaustHeatToRoom = (tTempF - roomTempF) * airExchangeFraction * (tentVolCuFt / roomVolCuFt);
    roomTempF += exhaustHeatToRoom * 0.2;

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
      // Mushroom cellular respiration (emit CO2 24/7)
      // Active FAE fan (50%) maintains healthy ~650-950 PPM; low fan allows CO2 to build up (1200-2500 PPM)
      const shroomBoost = (livingMushrooms.length * 160) / Math.max(0.2, fanFraction * 0.8 + 0.1);
      tCo2Target = roomCo2 + Math.min(2200, shroomBoost);
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
      enclosurePhotoperiodHours = 24;
    }

    tTempF = Math.max(45, Math.min(115, parseFloat(tTempF.toFixed(1))));
    tRH = Math.max(15, Math.min(99, Math.round(tRH)));
    tCo2 = Math.max(200, Math.min(5000, Math.round(tCo2)));
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
        heatMatActive
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
    if (isHumidifier(item)) {
      return { ...item, reservoirTempF: stepReservoirTempF(item, roomTempF, elapsedMinutes) };
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
      photoperiodHours: (isOutdoorGarden || isGreenhouse) ? 14 : 18,
      elapsedMinutes,
      currentSimTime,
      events,
      room,
      outside,
      tentName: isOutdoorGarden ? room.name : undefined,
      heatMatActive: false
    });
  });

  return {
    room: {
      ...room,
      climate: {
        tempF: roomTempF,
        tempC: roomTempC,
        rh: roomRH,
        lightPPFD: roomLightPPFD,
        vpdKpa: roomVPD,
        co2Ppm: roomCo2
      },
      tents: updatedTents,
      items: updatedRoomItems
    },
    events
  };
}

/**
 * Universal Crop Simulation Helper:
 * Evaluates soil dynamics, container volume buffering, medium drainage,
 * natural rainfall, microbial health, EC nutrient uptake, pH drift, and Hops lupulin accumulation.
 */
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
  heatMatActive?: boolean;
}): any {
  const { item, enclosureClimate, photoperiodHours, elapsedMinutes, currentSimTime, events, room, outside, tentName, heatMatActive } = params;

  if (item.category === 'plant') {
    const plant = { ...item } as PlantItem;
    const isDay = enclosureClimate.lightPPFD > 60;
    const isOutdoor = room.environmentType === 'outdoor_garden' || room.environmentType === 'greenhouse';

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
    let targetRootTemp = enclosureClimate.tempF * 0.75 + 16.0;
    if (heatMatActive) {
      targetRootTemp += 8.0;
    }
    if (isOutdoor) {
      targetRootTemp = enclosureClimate.tempF * 0.82 + 12.0;
    }
    const currentRoot = plant.rootTempF || targetRootTemp;
    plant.rootTempF = parseFloat((currentRoot + (targetRootTemp - currentRoot) * 0.05 * (elapsedMinutes / 10)).toFixed(1));

    // B. Soil & Medium Dynamics:
    // Volume buffering: 1-gal pot dries quickly; 10-gal or 50-gal raised bed buffers moisture
    const volGallons = plant.containerVolumeGallons || getDefaultContainerVolumeGallons(plant.containerType);
    const volBuffer = Math.max(0.2, Math.min(2.5, 5 / volGallons));
    
    let mediumDrainFactor = 1.0;
    if (plant.growingMedium === 'coco_perlite') mediumDrainFactor = 1.35;
    else if (plant.growingMedium === 'living_organic_soil' || plant.growingMedium === 'native_garden_loam') mediumDrainFactor = 0.85;
    else if (plant.systemType === 'dwc') mediumDrainFactor = 0.05;

    const transpirationRate = (isDay ? 0.08 : 0.02) * volBuffer * mediumDrainFactor;
    const moistureConsumed = transpirationRate * (elapsedMinutes / 60);
    plant.soilMoisture = Math.max(0, parseFloat((plant.soilMoisture - moistureConsumed).toFixed(2)));

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

    // C. Stage Suitability & Stress Assessment
    const stageSuitability = evaluatePlantStageSuitability(
      plant,
      enclosureClimate,
      plant.rootTempF,
      photoperiodHours
    );

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

    if (enclosureClimate.vpdKpa > 1.8) {
      healthDelta -= 0.2 * (elapsedMinutes / 60);
    } else if (enclosureClimate.vpdKpa < 0.35) {
      healthDelta -= 0.08 * (elapsedMinutes / 60);
    } else if (enclosureClimate.vpdKpa >= 0.8 && enclosureClimate.vpdKpa <= 1.4 && plant.soilMoisture > 40 && plant.soilMoisture < 80) {
      healthDelta += 0.25 * (elapsedMinutes / 60);
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
      const shroomProgressRate = (shroom.health / 100) * (elapsedMinutes / (60 * 24)) * vigorMult;
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
