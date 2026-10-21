import { Climate, OutsideConditions, PlantItem, MushroomItem, EquipmentItem, PersonItem, PetItem, Room, Tent, ControllerPriority, JournalCategory } from '../types/sim';
import { evaluatePlantStageSuitability, getNextPlantStage, DEFAULT_STAGE_DURATIONS } from './plantLifecycle';

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
          activeHumidifierCapacity += powerRatio * wattsFactor;
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
): { room: Room; events: Array<{ type: 'warning' | 'info'; title: string; message: string }> } {
  const events: Array<{ type: 'warning' | 'info'; title: string; message: string }> = [];
  const date = new Date(currentSimTime);
  const hour = date.getHours() + date.getMinutes() / 60;
  
  // 1. UPDATE ROOM CLIMATE (2005 Colonial House Envelope)
  const roomVolCuFt = Math.max(100, room.dimensions.length * room.dimensions.width * room.dimensions.height);
  const wallAreaSqFt = 2 * (room.dimensions.length + room.dimensions.width) * room.dimensions.height;
  const rValue = room.wallRValue || 19;
  const ach = room.airChangesPerHour || 0.35;

  let roomTempF = room.climate.tempF;
  let roomRH = room.climate.rh;
  let roomCo2 = room.climate.co2Ppm || 420;
  const hvacMode = room.hvacMode || 'central_ac_active';
  const coolingSetpoint = room.hvacCoolingSetpointF || 72.0;
  const heatingSetpoint = room.hvacHeatingSetpointF || 68.0;

  // Heat conduction through exterior walls: Q = U * A * (T_out - T_room)
  const uValue = 1 / Math.max(1, rValue);
  const wallHeatGainRate = (uValue * wallAreaSqFt * (outside.tempF - roomTempF)) / (roomVolCuFt * 1.08);
  const deltaTConduction = (wallHeatGainRate * (elapsedMinutes / 60));
  roomTempF += deltaTConduction * 0.4;

  // Infiltration: 0.35 ACH brings outdoor fresh air temp, humidity, and clean outdoor CO2
  const airExchangeRatePerHour = ach;
  const infiltrationFraction = Math.min(0.5, (airExchangeRatePerHour * (elapsedMinutes / 60)));
  roomTempF += (outside.tempF - roomTempF) * infiltrationFraction;
  roomRH += (outside.rh - roomRH) * infiltrationFraction * 0.3;
  roomCo2 += (outside.co2Ppm - roomCo2) * infiltrationFraction;

  // Central HVAC Conditioning (Standard 2005 Colonial with AC)
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
        const target = item.targetRh ?? 60;
        if (roomRH < target) {
          roomRH = Math.min(target, roomRH + 0.35 * (item.setting / 100) * (elapsedMinutes / 10));
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
  const roomTempC = parseFloat(fahrenheitToCelsius(roomTempF).toFixed(1));
  const roomLightPPFD = 10;
  const roomVPD = calculateVPD(roomTempF, roomRH, roomLightPPFD);

  // 2. UPDATE EACH TENT'S CLIMATE & ITS ITEMS
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

    const arbitration = arbitrateEnclosureEquipment({
      items: tent.items,
      climate: { tempF: tTempF, rh: tRH, co2Ppm: tCo2, lightPPFD: tent.climate.lightPPFD },
      ambientLungRoom: { tempF: roomTempF, rh: roomRH, co2Ppm: roomCo2 },
      priority: tentPriority,
      hour,
      simTime: currentSimTime,
      isTent: true,
      baseFanSpeed: tent.exhaustFanSpeed || 0,
      enclosureAreaSqFt: tentAreaSqFt
    });

    const {
      arbitratedItems,
      effectiveFanSpeed,
      activeInterlocks,
      activeHumidifierTarget,
      activeHumidifierCapacity,
      activeDehumidifierTarget,
      activeDehumidifierCapacity,
      co2RegulatorActive,
      co2RegulatorTarget,
      totalHeatWatts,
      lightPPFD: tLightPPFD,
      heatMatActive
    } = arbitration;

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
        tTempF -= 0.05 * (elapsedMinutes / 5) * activeHumidifierCapacity;
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

    // Update items inside tent (Plants & Mushrooms) using arbitrated equipment items
    const updatedItems = arbitratedItems.map(item => {
      if (item.category === 'plant') {
        const plant = { ...item };
        const isDay = tLightPPFD > 80;

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

        // A. Root Zone Temperature Simulation
        // Pot soil slowly equilibrates with tent ambient, room floor, and heat mat
        const floorTempF = room.foundationType === 'conditioned_basement' ? 66.0 : (roomTempF - 2.0);
        let targetRootTemp = tTempF * 0.7 + floorTempF * 0.3;
        if (heatMatActive) {
          targetRootTemp += 8.0; // Heat mat adds bottom warmth
        }
        const currentRoot = plant.rootTempF || targetRootTemp;
        plant.rootTempF = parseFloat((currentRoot + (targetRootTemp - currentRoot) * 0.05 * (elapsedMinutes / 10)).toFixed(1));

        // B. Plant Transpiration & Soil Moisture:
        // Transpiration draws soil moisture and adds water vapor to tent
        const transpirationRate = isDay ? 0.09 : 0.02;
        const moistureConsumed = transpirationRate * (elapsedMinutes / 60);
        plant.soilMoisture = Math.max(0, parseFloat((plant.soilMoisture - moistureConsumed).toFixed(2)));

        if (isDay && plant.soilMoisture > 15) {
          tRH += 0.15 * (elapsedMinutes / 10);
        }

        // C. Stage Suitability & Environmental Stress Assessment
        const tentVpd = calculateVPD(tTempF, tRH, tLightPPFD);
        const stageSuitability = evaluatePlantStageSuitability(
          plant,
          { tempF: tTempF, tempC: parseFloat(fahrenheitToCelsius(tTempF).toFixed(1)), rh: tRH, lightPPFD: tLightPPFD, vpdKpa: tentVpd, co2Ppm: tCo2 },
          plant.rootTempF,
          enclosurePhotoperiodHours
        );

        let healthDelta = 0;

        // Soil moisture stress
        if (plant.soilMoisture < 15) {
          healthDelta -= 0.25 * (elapsedMinutes / 60); // Drought stress
        } else if (plant.soilMoisture > 92) {
          healthDelta -= 0.15 * (elapsedMinutes / 60); // Saturated root rot
        }

        // Root zone temperature stress
        if (plant.rootTempF < 58) {
          healthDelta -= 0.1 * (elapsedMinutes / 60); // Chilled roots
        } else if (plant.rootTempF > 78) {
          healthDelta -= 0.15 * (elapsedMinutes / 60); // Root pathogens
        }

        // VPD stress
        if (tentVpd > 1.8) {
          healthDelta -= 0.2 * (elapsedMinutes / 60); // Stomata closed / leaf burn
        } else if (tentVpd < 0.35) {
          healthDelta -= 0.08 * (elapsedMinutes / 60); // Mold / guttation
        } else if (tentVpd >= 0.8 && tentVpd <= 1.4 && plant.soilMoisture > 40 && plant.soilMoisture < 80) {
          healthDelta += 0.25 * (elapsedMinutes / 60); // Healthy recovery
        }

        // Factor in stage suitability
        if (stageSuitability.status === 'optimal') {
          healthDelta += 0.1 * (elapsedMinutes / 60);
        } else if (stageSuitability.status === 'critical') {
          healthDelta -= 0.3 * (elapsedMinutes / 60);
        }

        plant.health = Math.max(0, Math.min(100, parseFloat((plant.health + healthDelta).toFixed(1))));

        // Track age & stage days
        const elapsedDays = elapsedMinutes / (60 * 24);
        plant.ageDays = parseFloat((plant.ageDays + elapsedDays).toFixed(2));
        plant.currentStageDays = parseFloat(((plant.currentStageDays || 0) + elapsedDays).toFixed(2));

        // D. Growth Progress & Cultivar Milestone Progression
        if (plant.health > 25 && !plant.isHarvested) {
          // Elevated CO2 (800-1400 ppm) with high PPFD provides +25% growth acceleration!
          let co2Multiplier = 1.0;
          if (isDay && tLightPPFD > 600) {
            if (tCo2 >= 1000 && tCo2 <= 1500) {
              co2Multiplier = 1.25; // Supercharged photosynthesis!
            } else if (tCo2 < 350) {
              co2Multiplier = 0.65; // CO2 starved
            }
          }

          // Expected days for current stage
          let expectedDays = DEFAULT_STAGE_DURATIONS[plant.stage] || 30;
          if (plant.stage === 'germination' && plant.germinationDaysExpected) expectedDays = plant.germinationDaysExpected;
          else if (plant.stage === 'rooting' && plant.rootingDaysExpected) expectedDays = plant.rootingDaysExpected;
          else if (plant.stage === 'seedling' && plant.seedlingDaysExpected) expectedDays = plant.seedlingDaysExpected;
          else if (plant.stage === 'mature_seedling' && plant.matureSeedlingDaysExpected) expectedDays = plant.matureSeedlingDaysExpected;
          else if (plant.stage === 'vegetative' && plant.vegetativeDaysExpected) expectedDays = plant.vegetativeDaysExpected;
          else if (plant.stage === 'flowering' && plant.floweringDaysExpected) expectedDays = plant.floweringDaysExpected;
          else if (plant.stage === 'ripening' && plant.ripeningDaysExpected) expectedDays = plant.ripeningDaysExpected;

          const baseDailyPercent = 100 / Math.max(1, expectedDays);
          const progressDelta = baseDailyPercent * elapsedDays * stageSuitability.overallScore * (plant.health / 100) * (isDay || plant.stage === 'germination' || plant.stage === 'rooting' ? 1.0 : 0.4) * co2Multiplier;
          plant.stageProgress = Math.min(100, plant.stageProgress + progressDelta);

          // Check for Stage Advancement & Milestone Date Recording!
          if (plant.stageProgress >= 100 && plant.stage !== 'ready') {
            plant.stageProgress = 0;
            plant.currentStageDays = 0;
            const previousStage = plant.stage;
            const nextStage = getNextPlantStage(plant.stage, plant.propagationType || 'seed');
            plant.stage = nextStage;

            // Record precise key date timestamps
            if (previousStage === 'germination') {
              plant.keyDates.sproutedDate = currentSimTime;
              plant.keyDates.seedlingDate = currentSimTime;
              events.push({
                type: 'info',
                title: `🌱 Seed Sprouted: ${plant.name}`,
                message: `${plant.name} has successfully germinated and broken through soil! Entered Seedling stage.`
              });
            } else if (previousStage === 'rooting') {
              plant.keyDates.rootedDate = currentSimTime;
              plant.keyDates.seedlingDate = currentSimTime;
              events.push({
                type: 'info',
                title: `🌱 Clone Rooted: ${plant.name}`,
                message: `${plant.name} cutting has successfully struck roots! Entered Seedling stage.`
              });
            } else if (previousStage === 'seedling') {
              plant.keyDates.matureSeedlingDate = currentSimTime;
              events.push({
                type: 'info',
                title: `🌿 Mature Seedling: ${plant.name}`,
                message: `${plant.name} has established multiple leaf sets. Entered Mature Seedling stage.`
              });
            } else if (previousStage === 'mature_seedling') {
              plant.keyDates.vegetativeDate = currentSimTime;
              events.push({
                type: 'info',
                title: `🌿 Vegetative Growth: ${plant.name}`,
                message: `${plant.name} is now in rapid vegetative growth under 18h lighting.`
              });
            } else if (previousStage === 'vegetative') {
              plant.keyDates.floweringDate = currentSimTime;
              events.push({
                type: 'info',
                title: `🌸 Flowering Transition: ${plant.name}`,
                message: `${plant.name} has initiated flowering! Calyx and pistil formation underway.`
              });
            } else if (previousStage === 'flowering') {
              plant.keyDates.ripeningDate = currentSimTime;
              events.push({
                type: 'info',
                title: `✨ Ripening Stage: ${plant.name}`,
                message: `${plant.name} entering late ripen phase. Trichome ambering and aroma peaking.`
              });
            } else if (previousStage === 'ripening') {
              plant.keyDates.readyDate = currentSimTime;
              events.push({
                type: 'info',
                title: `🏆 Ready for Harvest: ${plant.name}`,
                message: `${plant.name} has reached peak maturity and resin density. Ready to harvest!`
              });
            }
          }

          // Size & yield potential scaling based on stage
          if (plant.stage === 'seedling') {
            plant.heightInches = Math.min(8, plant.heightInches + 0.005 * progressDelta);
            plant.canopyWidthInches = Math.min(6, plant.canopyWidthInches + 0.004 * progressDelta);
          } else if (plant.stage === 'mature_seedling') {
            plant.heightInches = Math.min(14, plant.heightInches + 0.01 * progressDelta);
            plant.canopyWidthInches = Math.min(12, plant.canopyWidthInches + 0.01 * progressDelta);
          } else if (plant.stage === 'vegetative') {
            plant.heightInches = Math.min(48, plant.heightInches + 0.025 * progressDelta);
            plant.canopyWidthInches = Math.min(36, plant.canopyWidthInches + 0.025 * progressDelta);
          } else if (plant.stage === 'flowering' || plant.stage === 'ripening') {
            plant.yieldPotentialGrams = Math.min(380, plant.yieldPotentialGrams + 0.18 * progressDelta);
          }
        }

        return plant;
      } else if (item.category === 'mushroom') {
        const shroom = { ...item };

        // Fungi cellular respiration:
        // Canopy CO2 enrichment is continuously calculated via ventilation mass balance.

        let healthDelta = 0;
        // High humidity requirement
        if (tRH < 70) {
          healthDelta -= 0.35 * (elapsedMinutes / 60); // Pins drying
        } else if (tRH >= 85) {
          healthDelta += 0.25 * (elapsedMinutes / 60);
        }

        // High CO2 impact on mushroom stages:
        // Colonization loves high CO2 (2000-5000 ppm)
        // Fruiting requires Fresh Air Exchange (FAE) (<1000 ppm) to prevent leggy fuzzy stems
        if (shroom.stage === 'fruiting' || shroom.stage === 'pinning') {
          if (tCo2 > 1300) {
            healthDelta -= 0.15 * (elapsedMinutes / 60); // Fuzzy feet / cap deformity
          }
        }

        // Substrate moisture loss
        const loss = 0.03 * (elapsedMinutes / 60);
        shroom.substrateMoisture = Math.max(0, parseFloat((shroom.substrateMoisture - loss).toFixed(2)));
        if (shroom.substrateMoisture < 40) {
          healthDelta -= 0.25 * (elapsedMinutes / 60);
        }

        shroom.health = Math.max(0, Math.min(100, parseFloat((shroom.health + healthDelta).toFixed(1))));

        if (shroom.health > 35 && !shroom.isHarvested) {
          const shroomProgressRate = (shroom.health / 100) * (elapsedMinutes / (60 * 24));
          shroom.ageDays = parseFloat((shroom.ageDays + elapsedMinutes / (60 * 24)).toFixed(2));
          shroom.stageProgress = Math.min(100, shroom.stageProgress + shroomProgressRate * 14);

          if (shroom.stageProgress >= 100) {
            shroom.stageProgress = 0;
            if (shroom.stage === 'colonizing') shroom.stage = 'pinning';
            else if (shroom.stage === 'pinning') shroom.stage = 'fruiting';
            else if (shroom.stage === 'fruiting') shroom.stage = 'mature';
            else if (shroom.stage === 'mature') shroom.stage = 'ready';
          }

          if (shroom.stage === 'fruiting' || shroom.stage === 'mature') {
            shroom.yieldPotentialGrams = Math.min(480, shroom.yieldPotentialGrams + 0.3 * (elapsedMinutes / 60));
          }
        }

        return shroom;
      }
      return item;
    });

    tTempF = Math.max(45, Math.min(115, parseFloat(tTempF.toFixed(1))));
    tRH = Math.max(15, Math.min(99, Math.round(tRH)));
    tCo2 = Math.max(200, Math.min(5000, Math.round(tCo2)));
    const tTempC = parseFloat(fahrenheitToCelsius(tTempF).toFixed(1));
    const tVPD = calculateVPD(tTempF, tRH, tLightPPFD);

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
      tents: updatedTents
    },
    events
  };
}
