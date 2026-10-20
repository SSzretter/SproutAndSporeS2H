import { Climate, OutsideConditions, PlantItem, MushroomItem, EquipmentItem, PersonItem, PetItem, Room, Tent } from '../types/sim';

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
 * Simulates a single tick of the environmental physics loop
 * elapsedMinutes: number of game minutes progressed
 * 
 * Accurately models:
 * 1. 2005 Colonial House Construction (R-19 exterior walls, 0.35 ACH infiltration, Central HVAC)
 * 2. Room ambient impact on Tents (Mylar fabric conduction + CFM air exchange from Lung Room)
 * 3. Tent lights & equipment heat loads and plant transpiration
 * 4. Root zone temperature dynamics influenced by ambient floor & watering
 * 5. Dynamic CO2 consumption (plants under light) and production (mushrooms & human baseline)
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
  // R-19 exterior wall insulation: U-value = 1/19 = 0.0526 BTU/hr·ft²·°F
  // Infiltration: 0.35 ACH (Air Changes per Hour to outdoor ambient)
  const roomVolCuFt = Math.max(100, room.dimensions.length * room.dimensions.width * room.dimensions.height);
  const wallAreaSqFt = 2 * (room.dimensions.length + room.dimensions.width) * room.dimensions.height;
  const rValue = room.wallRValue || 19; // 2005 Colonial standard
  const ach = room.airChangesPerHour || 0.35; // 0.35 ACH

  let roomTempF = room.climate.tempF;
  let roomRH = room.climate.rh;
  let roomCo2 = room.climate.co2Ppm || 420;
  const hvacMode = room.hvacMode || 'central_ac_active';
  const coolingSetpoint = room.hvacCoolingSetpointF || 72.0;
  const heatingSetpoint = room.hvacHeatingSetpointF || 68.0;

  // Heat conduction through exterior walls: Q = U * A * (T_out - T_room)
  // Converted to temperature rate change per minute in room air
  const uValue = 1 / Math.max(1, rValue);
  const wallHeatGainRate = (uValue * wallAreaSqFt * (outside.tempF - roomTempF)) / (roomVolCuFt * 1.08); // °F/hr
  const deltaTConduction = (wallHeatGainRate * (elapsedMinutes / 60));
  roomTempF += deltaTConduction * 0.4; // Thermal mass damping from drywall and framing

  // Infiltration: 0.35 ACH brings outdoor fresh air temp, humidity, and 420 ppm clean outdoor CO2
  const airExchangeRatePerHour = ach;
  const infiltrationFraction = Math.min(0.5, (airExchangeRatePerHour * (elapsedMinutes / 60)));
  roomTempF += (outside.tempF - roomTempF) * infiltrationFraction;
  roomRH += (outside.rh - roomRH) * infiltrationFraction * 0.3; // Moisture buffering by building materials
  roomCo2 += (outside.co2Ppm - roomCo2) * infiltrationFraction;

  // Central HVAC Conditioning (Standard 2005 Colonial with AC)
  if (hvacMode === 'central_ac_active') {
    if (roomTempF > coolingSetpoint) {
      // AC cooling power pulls room temp toward 72°F and dehumidifies slightly
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
  // 1 cubic foot = 28.3168 liters of air
  const roomVolLiters = roomVolCuFt * 28.3168;
  let roomOccupantCo2LitersPerHour = 0;
  let roomOccupantHeatWatts = 0;
  let roomOccupantMoistureLitersPerDay = 0;

  room.items.forEach(item => {
    if (item.category === 'person') {
      roomOccupantCo2LitersPerHour += item.co2RateLitersPerHour;
      roomOccupantHeatWatts += item.heatOutputWatts;
      roomOccupantMoistureLitersPerDay += item.moistureLitersPerDay;
    } else if (item.category === 'pet') {
      roomOccupantCo2LitersPerHour += item.co2RateLitersPerHour;
      roomOccupantHeatWatts += item.heatOutputWatts;
      roomOccupantMoistureLitersPerDay += item.moistureLitersPerDay;
    }
  });

  // Calculate dynamic CO2 added by actual occupants in the room:
  // PPM added = (Liters CO2 exhaled / Room Volume in Liters) * 1,000,000
  if (roomOccupantCo2LitersPerHour > 0) {
    const emittedLiters = roomOccupantCo2LitersPerHour * (elapsedMinutes / 60);
    const addedPpm = (emittedLiters / roomVolLiters) * 1_000_000;
    roomCo2 += addedPpm;
  }

  // Metabolic heat emitted by occupants
  if (roomOccupantHeatWatts > 0) {
    const occupantHeatGainRate = (roomOccupantHeatWatts * 3.412) / (roomVolCuFt * 1.08); // °F/hr
    roomTempF += occupantHeatGainRate * (elapsedMinutes / 60) * 0.35;
  }

  // Respiration moisture emitted by occupants
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
  // Tents are situated inside the host room!
  // Tent Mylar canvas conducts heat with host room: Q = U * A * (T_room - T_tent)
  // Exhaust fan draws air from the Lung Room into the tent!
  const updatedTents: Tent[] = room.tents.map(tent => {
    let tTempF = tent.climate.tempF;
    let tRH = tent.climate.rh;
    let tCo2 = tent.climate.co2Ppm || roomCo2;
    let tLightPPFD = 0;
    let totalHeatWatts = 0;
    let co2RegulatorTarget: number | null = null;
    let co2RegulatorActive = false;
    let heatMatActive = false;

    // Check equipment in tent
    tent.items.forEach(item => {
      if (item.category === 'equipment') {
        if (item.type === 'grow_light') {
          const isTimerOn = isLightScheduledOn(hour, item.schedule);
          if (item.powerOn && isTimerOn) {
            const powerRatio = item.setting / 100;
            const effectiveWatts = item.powerWatts * powerRatio;
            totalHeatWatts += effectiveWatts;
            
            // Tent floor area in sq ft
            const areaSqFt = Math.max(1, tent.dimensions.length * tent.dimensions.width);
            const areaM2 = areaSqFt * 0.0929;
            const ppfd = Math.round((effectiveWatts * 2.1) / areaM2);
            tLightPPFD = Math.max(tLightPPFD, ppfd);
          }
        } else if (item.type === 'humidifier' && item.powerOn) {
          const target = item.targetRh ?? 70;
          if (tRH < target) {
            const mistPower = (item.setting / 100) * 0.85 * (elapsedMinutes / 5);
            tRH = Math.min(98, tRH + mistPower);
            tTempF -= 0.03 * (elapsedMinutes / 5); // Evaporative cooling
          }
        } else if (item.type === 'dehumidifier' && item.powerOn) {
          const target = item.targetRh ?? 50;
          if (tRH > target) {
            const dehumPower = (item.setting / 100) * 0.7 * (elapsedMinutes / 5);
            tRH = Math.max(target, tRH - dehumPower);
            tTempF += 0.04 * (elapsedMinutes / 5); // Compressor heat
          }
        } else if (item.type === 'heater' && item.powerOn) {
          const target = item.targetTempF ?? 76;
          if (tTempF < target) {
            tTempF += 0.12 * (item.setting / 100) * (elapsedMinutes / 5);
          }
        } else if (item.type === 'co2_regulator' && item.powerOn) {
          co2RegulatorActive = true;
          co2RegulatorTarget = item.targetCo2Ppm ?? 1200;
        } else if (item.type === 'co2_bag') {
          // Passive biological CO2 emitter (ExHale bag)
          tCo2 += 1.5 * (elapsedMinutes / 10);
        } else if (item.type === 'heat_mat' && item.powerOn) {
          heatMatActive = true;
        }
      } else if (item.category === 'person' || item.category === 'pet') {
        const tentVolCuFt = tent.dimensions.length * tent.dimensions.width * tent.dimensions.height;
        const tentVolLiters = Math.max(30, tentVolCuFt) * 28.3168;
        const emittedLiters = item.co2RateLitersPerHour * (elapsedMinutes / 60);
        tCo2 += (emittedLiters / tentVolLiters) * 1_000_000;
        totalHeatWatts += item.heatOutputWatts;
        tRH = Math.min(99, tRH + 0.1 * (elapsedMinutes / 5));
      }
    });

    // 1. Heat addition from grow lights
    // Sensible heat from LED drivers and diodes heats the tent air
    const tentVolCuFt = tent.dimensions.length * tent.dimensions.width * tent.dimensions.height;
    const lightHeatDelta = (totalHeatWatts / Math.max(40, tentVolCuFt)) * 0.022 * (elapsedMinutes / 5);
    tTempF += lightHeatDelta;

    // 2. Heat conduction through Mylar tent fabric with Host Room air:
    // Heavy Oxford fabric (1680D/2000D) has R ~ 0.7 (U ~ 1.4 BTU/hr·ft²·°F)
    const tentSurfaceArea = 2 * (tent.dimensions.length * tent.dimensions.height + tent.dimensions.width * tent.dimensions.height) + (tent.dimensions.length * tent.dimensions.width);
    const fabricConductionRate = (1.4 * tentSurfaceArea * (roomTempF - tTempF)) / (tentVolCuFt * 1.08); // °F/hr
    tTempF += (fabricConductionRate * (elapsedMinutes / 60)) * 0.25;

    // 3. Ventilation & Air Exchange with Host Lung Room:
    // When inline exhaust fan pulls air, replacement air enters from Room
    let exhaustFanSetting = tent.exhaustFanSpeed || 0;
    tent.items.forEach(item => {
      if (item.category === 'equipment' && item.type === 'exhaust_fan' && item.powerOn) {
        exhaustFanSetting = Math.max(exhaustFanSetting, item.setting);
      }
    });

    // Effective air changes per minute:
    // In a typical 4x4 or 3x3 tent (100-200 cu ft), an inline fan (100-250 CFM) at 50% moves ~75-125 CFM.
    // That corresponds to ~0.5 to 1.0 air exchanges per minute!
    const fanFraction = exhaustFanSetting / 100;
    const airExchangeFraction = Math.min(0.95, 1 - Math.exp(-Math.max(0.04, fanFraction * 0.45) * elapsedMinutes));
    tTempF += (roomTempF - tTempF) * airExchangeFraction;
    tRH += (roomRH - tRH) * airExchangeFraction;

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
        if (exhaustFanSetting >= 50) {
          maxDrawdownPpm = 20 + healthyPlantsCount * 2.5; // ~25-35 PPM drawdown (e.g. 385-395 PPM when room is 420)
        } else if (exhaustFanSetting >= 20) {
          maxDrawdownPpm = 35 + healthyPlantsCount * 4.0; // ~45-60 PPM drawdown
        } else if (exhaustFanSetting > 0) {
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

    // Update items inside tent (Plants & Mushrooms)
    const updatedItems = tent.items.map(item => {
      if (item.category === 'plant') {
        const plant = { ...item };
        const isDay = tLightPPFD > 80;

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

        // C. Photosynthesis Carbon Utilization:
        // Canopy CO2 is continuously calculated via ventilation mass balance and Rubisco kinetics.

        // D. Health & Environmental Stress
        const tentVpd = calculateVPD(tTempF, tRH, tLightPPFD);
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

        plant.health = Math.max(0, Math.min(100, parseFloat((plant.health + healthDelta).toFixed(1))));

        // E. Growth Progress & CO2 Boost Multiplier
        if (plant.health > 40 && !plant.isHarvested) {
          // Elevated CO2 (800-1400 ppm) with high PPFD provides +25% growth acceleration!
          let co2Multiplier = 1.0;
          if (isDay && tLightPPFD > 600) {
            if (tCo2 >= 1000 && tCo2 <= 1500) {
              co2Multiplier = 1.25; // Supercharged photosynthesis!
            } else if (tCo2 < 350) {
              co2Multiplier = 0.65; // CO2 starved
            }
          }

          const growthRate = (plant.health / 100) * (isDay ? 1.0 : 0.4) * co2Multiplier * (elapsedMinutes / (60 * 24));
          plant.ageDays = parseFloat((plant.ageDays + elapsedMinutes / (60 * 24)).toFixed(2));
          plant.stageProgress = Math.min(100, plant.stageProgress + growthRate * 10);

          if (plant.stageProgress >= 100) {
            plant.stageProgress = 0;
            if (plant.stage === 'seedling') plant.stage = 'vegetative';
            else if (plant.stage === 'vegetative') plant.stage = 'flowering';
            else if (plant.stage === 'flowering') plant.stage = 'ripening';
            else if (plant.stage === 'ripening') plant.stage = 'ready';
          }

          // Size & yield potential scaling
          if (plant.stage === 'vegetative') {
            plant.heightInches = Math.min(48, plant.heightInches + 0.025 * growthRate * 10);
            plant.canopyWidthInches = Math.min(36, plant.canopyWidthInches + 0.025 * growthRate * 10);
          } else if (plant.stage === 'flowering' || plant.stage === 'ripening') {
            plant.yieldPotentialGrams = Math.min(380, plant.yieldPotentialGrams + 0.18 * growthRate * 10);
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
