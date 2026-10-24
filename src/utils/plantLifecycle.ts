import { PlantItem, PlantStage, PropagationType, StageConditionRequirements, Climate } from '../types/sim';

export interface StageSuitabilityReport {
  overallScore: number; // 0 to 1.5 multiplier
  status: 'optimal' | 'acceptable' | 'stressful' | 'critical';
  limitingFactor?: string;
  tempStatus: 'ideal' | 'too_cold' | 'too_hot';
  rhStatus: 'ideal' | 'too_dry' | 'too_humid';
  vpdStatus: 'ideal' | 'too_low' | 'too_high';
  ppfdStatus: 'ideal' | 'insufficient' | 'excessive_burn';
  rootTempStatus: 'ideal' | 'chilled' | 'hot';
  moistureStatus: 'ideal' | 'underwatered' | 'waterlogged';
  photoperiodStatus: 'aligned' | 'flowering_interrupted' | 'vegetative_trigger';
  details: string[];
}

export const DEFAULT_STAGE_REQUIREMENTS: Record<PlantStage, StageConditionRequirements> = {
  germination: {
    tempMinF: 72,
    tempMaxF: 84,
    tempOptimalF: 78,
    rhMin: 70,
    rhMax: 95,
    rhOptimal: 80,
    vpdMin: 0.3,
    vpdMax: 0.8,
    vpdOptimal: 0.5,
    ppfdMin: 0,
    ppfdOptimal: 50, // Seeds germinate best in dark or very gentle starter light
    soilMoistureMin: 65,
    soilMoistureOptimal: 80,
    targetPhotoperiodHours: 18,
    summary: 'High moisture, warm root zone (75-80°F), low/dim starter light.'
  },
  rooting: {
    tempMinF: 72,
    tempMaxF: 80,
    tempOptimalF: 76,
    rhMin: 75,
    rhMax: 95,
    rhOptimal: 85, // Clones lack roots; require high RH humidity dome
    vpdMin: 0.25,
    vpdMax: 0.7,
    vpdOptimal: 0.45,
    ppfdMin: 60,
    ppfdOptimal: 120, // Gentle clone lighting
    soilMoistureMin: 60,
    soilMoistureOptimal: 78,
    targetPhotoperiodHours: 18,
    summary: 'Requires high ambient humidity (80-90% dome) and warm substrate to initiate adventitious root primordia.'
  },
  seedling: {
    tempMinF: 70,
    tempMaxF: 80,
    tempOptimalF: 75,
    rhMin: 62,
    rhMax: 78,
    rhOptimal: 70,
    vpdMin: 0.5,
    vpdMax: 0.9,
    vpdOptimal: 0.7,
    ppfdMin: 120,
    ppfdOptimal: 220,
    soilMoistureMin: 50,
    soilMoistureOptimal: 70,
    targetPhotoperiodHours: 18,
    summary: 'Cotyledons and first true leaves. Gentle light (150-250 PPFD) and moderate VPD to prevent wilting.'
  },
  mature_seedling: {
    tempMinF: 70,
    tempMaxF: 82,
    tempOptimalF: 76,
    rhMin: 58,
    rhMax: 72,
    rhOptimal: 65,
    vpdMin: 0.7,
    vpdMax: 1.1,
    vpdOptimal: 0.85,
    ppfdMin: 200,
    ppfdOptimal: 350,
    soilMoistureMin: 45,
    soilMoistureOptimal: 68,
    targetPhotoperiodHours: 18,
    summary: 'Multiple leaf sets with robust root network. Preparing for rapid vegetative branch expansion.'
  },
  vegetative: {
    tempMinF: 72,
    tempMaxF: 84,
    tempOptimalF: 78,
    rhMin: 50,
    rhMax: 68,
    rhOptimal: 60,
    vpdMin: 0.8,
    vpdMax: 1.3,
    vpdOptimal: 1.05,
    ppfdMin: 350,
    ppfdOptimal: 600,
    soilMoistureMin: 40,
    soilMoistureOptimal: 65,
    targetPhotoperiodHours: 18,
    summary: 'Vigorous cellular and foliage expansion. High light intensity (400-700 PPFD) and 18h daylight photoperiod.'
  },
  flowering: {
    tempMinF: 68,
    tempMaxF: 80,
    tempOptimalF: 75,
    rhMin: 40,
    rhMax: 55,
    rhOptimal: 48,
    vpdMin: 1.1,
    vpdMax: 1.6,
    vpdOptimal: 1.35,
    ppfdMin: 550,
    ppfdOptimal: 850,
    soilMoistureMin: 40,
    soilMoistureOptimal: 65,
    targetPhotoperiodHours: 12,
    summary: 'Bud formation, calyx swelling and heavy resin production. Lower RH (40-50%) prevents botrytis bud rot.'
  },
  ripening: {
    tempMinF: 65,
    tempMaxF: 76,
    tempOptimalF: 72,
    rhMin: 35,
    rhMax: 50,
    rhOptimal: 42,
    vpdMin: 1.2,
    vpdMax: 1.65,
    vpdOptimal: 1.4,
    ppfdMin: 500,
    ppfdOptimal: 750,
    soilMoistureMin: 30,
    soilMoistureOptimal: 55,
    targetPhotoperiodHours: 12,
    summary: 'Trichome clouding/ambering and fruit maturation. Crisp, lower humidity protects dense colas from mold.'
  },
  ready: {
    tempMinF: 64,
    tempMaxF: 74,
    tempOptimalF: 70,
    rhMin: 35,
    rhMax: 48,
    rhOptimal: 40,
    vpdMin: 1.2,
    vpdMax: 1.6,
    vpdOptimal: 1.35,
    ppfdMin: 300,
    ppfdOptimal: 500,
    soilMoistureMin: 20,
    soilMoistureOptimal: 45,
    targetPhotoperiodHours: 12,
    summary: 'Fully mature, peak potency and terpene profiles. Ready for harvest and slow dry/cure.'
  }
};

export const DEFAULT_STAGE_DURATIONS: Record<PlantStage, number> = {
  germination: 5,     // 3 to 7 days for seeds to sprout
  rooting: 10,        // 7 to 14 days for cuttings to root
  seedling: 8,        // 6 to 10 days
  mature_seedling: 10, // 8 to 14 days
  vegetative: 30,     // 21 to 45 days
  flowering: 56,      // 50 to 70 days
  ripening: 10,       // 7 to 14 days
  ready: 5            // harvest window
};

/**
 * Evaluates how close current environmental conditions are to the plant's stage requirements.
 */
export function evaluatePlantStageSuitability(
  plant: PlantItem,
  climate: Climate,
  rootTempF: number,
  actualPhotoperiodHours: number = 18
): StageSuitabilityReport {
  const req = plant.stageRequirements?.[plant.stage] || DEFAULT_STAGE_REQUIREMENTS[plant.stage];
  const details: string[] = [];
  let scoreMultiplier = 1.0;

  // Temperature
  let tempStatus: 'ideal' | 'too_cold' | 'too_hot' = 'ideal';
  if (climate.tempF < req.tempMinF) {
    tempStatus = 'too_cold';
    const def = req.tempMinF - climate.tempF;
    scoreMultiplier *= Math.max(0.2, 1 - def * 0.08);
    details.push(`Low ambient temp (${climate.tempF.toFixed(1)}°F < min ${req.tempMinF}°F). Growth slowed.`);
  } else if (climate.tempF > req.tempMaxF) {
    tempStatus = 'too_hot';
    const exc = climate.tempF - req.tempMaxF;
    scoreMultiplier *= Math.max(0.3, 1 - exc * 0.08);
    details.push(`High ambient temp (${climate.tempF.toFixed(1)}°F > max ${req.tempMaxF}°F). Heat stress.`);
  } else {
    details.push(`Temperature optimal (${climate.tempF.toFixed(1)}°F).`);
  }

  // Relative Humidity
  let rhStatus: 'ideal' | 'too_dry' | 'too_humid' = 'ideal';
  if (climate.rh < req.rhMin) {
    rhStatus = 'too_dry';
    const def = req.rhMin - climate.rh;
    scoreMultiplier *= Math.max(0.3, 1 - def * 0.03);
    details.push(`Air too dry (${climate.rh}% < target ${req.rhMin}%). High transpiration demand.`);
  } else if (climate.rh > req.rhMax) {
    rhStatus = 'too_humid';
    const exc = climate.rh - req.rhMax;
    scoreMultiplier *= Math.max(0.4, 1 - exc * 0.02);
    details.push(`Air too humid (${climate.rh}% > max ${req.rhMax}%). Mold risk.`);
  } else {
    details.push(`Humidity aligned (${climate.rh}%).`);
  }

  // VPD (Vapor Pressure Deficit)
  let vpdStatus: 'ideal' | 'too_low' | 'too_high' = 'ideal';
  if (climate.vpdKpa < req.vpdMin) {
    vpdStatus = 'too_low';
    scoreMultiplier *= 0.85;
    details.push(`VPD low (${climate.vpdKpa} kPa). Transpiration sluggish.`);
  } else if (climate.vpdKpa > req.vpdMax) {
    vpdStatus = 'too_high';
    scoreMultiplier *= 0.75;
    details.push(`VPD high (${climate.vpdKpa} kPa). Leaf stomata closing.`);
  } else {
    details.push(`VPD in the sweet spot (${climate.vpdKpa} kPa).`);
  }

  // Light PPFD
  let ppfdStatus: 'ideal' | 'insufficient' | 'excessive_burn' = 'ideal';
  if (plant.stage === 'germination') {
    if (climate.lightPPFD > 150) {
      ppfdStatus = 'excessive_burn';
      scoreMultiplier *= 0.7;
      details.push(`Light too intense for seed germination (${climate.lightPPFD} PPFD). Dim lights.`);
    }
  } else if (plant.stage === 'rooting') {
    if (climate.lightPPFD > 250) {
      ppfdStatus = 'excessive_burn';
      scoreMultiplier *= 0.6;
      details.push(`Light too intense for rootless clone (${climate.lightPPFD} PPFD). High transpiration.`);
    } else if (climate.lightPPFD < req.ppfdMin) {
      ppfdStatus = 'insufficient';
      scoreMultiplier *= 0.8;
      details.push(`Lighting dim for rooting cutting (${climate.lightPPFD} PPFD).`);
    }
  } else {
    if (climate.lightPPFD < req.ppfdMin) {
      ppfdStatus = 'insufficient';
      scoreMultiplier *= Math.max(0.35, climate.lightPPFD / Math.max(1, req.ppfdMin));
      details.push(`Insufficient PPFD (${climate.lightPPFD} < min ${req.ppfdMin}).`);
    } else if (climate.lightPPFD > req.ppfdOptimal * 1.45) {
      ppfdStatus = 'excessive_burn';
      scoreMultiplier *= 0.85;
      details.push(`High PPFD (${climate.lightPPFD}). Ensure CO₂ supplementation.`);
    }
  }

  // Root Zone Temperature
  let rootTempStatus: 'ideal' | 'chilled' | 'hot' = 'ideal';
  
  if (plant.species === 'Chili Pepper' && plant.stage === 'germination') {
    // Hot peppers (Capsicum annuum, chinense, frutescens) require high bottom heat to break dormancy!
    if (rootTempF < 64) {
      rootTempStatus = 'chilled';
      scoreMultiplier *= 0.15;
      details.push(`Substrate critically cold (${rootTempF.toFixed(1)}°F < 75°F). Pepper seed germination stalled; high damping-off risk.`);
    } else if (rootTempF < 72) {
      rootTempStatus = 'chilled';
      scoreMultiplier *= 0.45;
      details.push(`Substrate cool (${rootTempF.toFixed(1)}°F). Pepper germination sluggish; heat mat recommended for 80-85°F.`);
    } else if (rootTempF >= 78 && rootTempF <= 88) {
      scoreMultiplier *= 1.45;
      details.push(`Substrate heat optimal (${rootTempF.toFixed(1)}°F). Vigorous seed coat imbibition & rapid radicle emergence!`);
    } else if (rootTempF > 92) {
      rootTempStatus = 'hot';
      scoreMultiplier *= 0.5;
      details.push(`Substrate excessive heat (${rootTempF.toFixed(1)}°F > 92°F). Thermal seed dormancy triggered.`);
    } else {
      details.push(`Substrate temp acceptable (${rootTempF.toFixed(1)}°F).`);
    }
  } else if (rootTempF < 62) {
    rootTempStatus = 'chilled';
    scoreMultiplier *= 0.7;
    details.push(`Root zone cold (${rootTempF.toFixed(1)}°F). Phosphorus & nutrient uptake stalled.`);
  } else if (rootTempF > 78 && plant.species !== 'Chili Pepper') {
    rootTempStatus = 'hot';
    scoreMultiplier *= 0.8;
    details.push(`Root zone warm (${rootTempF.toFixed(1)}°F). Watch for pythium/root rot.`);
  } else {
    if (plant.stage === 'germination' || plant.stage === 'rooting') {
      if (rootTempF >= 72 && rootTempF <= 78) {
        scoreMultiplier *= 1.25; // Heat mat accelerates germination & rooting!
        details.push(`Substrate temperature warm (${rootTempF.toFixed(1)}°F). Accelerated rooting!`);
      }
    }
  }

  // Soil Moisture
  let moistureStatus: 'ideal' | 'underwatered' | 'waterlogged' = 'ideal';
  if (plant.soilMoisture < req.soilMoistureMin) {
    moistureStatus = 'underwatered';
    scoreMultiplier *= Math.max(0.1, plant.soilMoisture / req.soilMoistureMin);
    details.push(`Soil drought (${plant.soilMoisture.toFixed(0)}% < min ${req.soilMoistureMin}%).`);
  } else if (plant.soilMoisture > 92) {
    moistureStatus = 'waterlogged';
    scoreMultiplier *= 0.65;
    details.push(`Medium oversaturated (${plant.soilMoisture.toFixed(0)}%). Root suffocation.`);
  }

  // Soil & Hydroponic Dynamics Assessment:
  const isHydro = plant.systemType === 'dwc' || plant.systemType === 'ebb_and_flow' || plant.systemType === 'drip_hydro' || plant.systemType === 'aeroponics';
  const currentPh = plant.soilPh ?? (isHydro ? 5.8 : 6.4);
  const currentEc = plant.ecTdsPpm ?? 950;

  // pH Lockout Check
  if (isHydro) {
    if (currentPh < 5.3) {
      scoreMultiplier *= 0.7;
      details.push(`Hydro solution acidic (pH ${currentPh.toFixed(1)} < 5.5). Calcium & magnesium locked out.`);
    } else if (currentPh > 6.4) {
      scoreMultiplier *= 0.7;
      details.push(`Hydro solution alkaline (pH ${currentPh.toFixed(1)} > 6.2). Iron & micronutrients precipitating.`);
    } else {
      details.push(`Hydro reservoir pH optimal (${currentPh.toFixed(1)}).`);
    }
  } else {
    // Soil / Raised Bed / In-ground
    if (currentPh < 5.8) {
      scoreMultiplier *= 0.75;
      details.push(`Soil medium acidic (pH ${currentPh.toFixed(1)} < 6.0). Micronutrient toxicity & phosphorus lockout.`);
    } else if (currentPh > 7.1) {
      scoreMultiplier *= 0.75;
      details.push(`Soil medium alkaline (pH ${currentPh.toFixed(1)} > 6.8). Iron & zinc locked out.`);
    } else {
      details.push(`Soil pH in optimal absorption zone (${currentPh.toFixed(1)}).`);
    }
  }

  // EC / Nutrient Strength Check
  if (plant.stage === 'germination' || plant.stage === 'seedling' || plant.stage === 'rooting') {
    if (currentEc > 800) {
      scoreMultiplier *= 0.7;
      details.push(`Nutrient strength too hot for delicate roots (${currentEc} PPM > 800 PPM).`);
    }
  } else if (plant.stage === 'flowering' || plant.stage === 'ripening') {
    if (currentEc > 1850) {
      scoreMultiplier *= 0.8;
      details.push(`High EC (${currentEc} PPM). Leaf tip burn and salt accumulation.`);
    } else if (currentEc < 550) {
      scoreMultiplier *= 0.85;
      details.push(`Low EC (${currentEc} PPM). Bloom underfed; cone/fruit swelling limited.`);
    }
  }

  // Microbial Activity Bonus
  if (plant.microbialHealth && plant.microbialHealth > 70) {
    scoreMultiplier *= 1.1; // Living soil beneficial microbes accelerate nutrient assimilation!
    details.push(`Active living soil biology (${plant.microbialHealth}% microbial health) boosting root assimilation!`);
  }

  // DWC Rapid Veg Bonus
  if (plant.systemType === 'dwc' && plant.stage === 'vegetative') {
    scoreMultiplier *= 1.18; // Explosive deep water culture growth
    details.push(`DWC high dissolved oxygen aeration delivering explosive vegetative foliage growth!`);
  }

  // Hops High-Sunlight & Trellis Bonus
  if (plant.species === 'Hops') {
    if (climate.lightPPFD > 750) {
      scoreMultiplier *= 1.15;
      details.push(`High solar PPFD (${climate.lightPPFD} μmol) fueling rapid vertical hop bine climbing!`);
    }
  }

  // Photoperiod Alignment
  let photoperiodStatus: 'aligned' | 'flowering_interrupted' | 'vegetative_trigger' = 'aligned';
  if (plant.stage === 'flowering' || plant.stage === 'ripening') {
    if (actualPhotoperiodHours > 13) {
      photoperiodStatus = 'flowering_interrupted';
      scoreMultiplier *= 0.4;
      details.push(`Photoperiod too long (${actualPhotoperiodHours}h > 12h)! Risks revegetation/hermaphroditism.`);
    }
  } else if (plant.stage === 'vegetative' || plant.stage === 'seedling' || plant.stage === 'mature_seedling') {
    if (actualPhotoperiodHours <= 12) {
      photoperiodStatus = 'vegetative_trigger';
      details.push(`Short photoperiod (${actualPhotoperiodHours}h) may trigger premature flowering.`);
    }
  }

  const clampedScore = Math.max(0.05, Math.min(1.5, parseFloat(scoreMultiplier.toFixed(2))));
  const status: 'optimal' | 'acceptable' | 'stressful' | 'critical' = 
    clampedScore >= 0.95 ? 'optimal' : clampedScore >= 0.7 ? 'acceptable' : clampedScore >= 0.4 ? 'stressful' : 'critical';

  return {
    overallScore: clampedScore,
    status,
    limitingFactor: details.find(d => !d.includes('optimal') && !d.includes('aligned') && !d.includes('boosting') && !d.includes('delivering') && !d.includes('fueling')),
    tempStatus,
    rhStatus,
    vpdStatus,
    ppfdStatus,
    rootTempStatus,
    moistureStatus,
    photoperiodStatus,
    details
  };
}

export interface HopCultivarProfile {
  name: string;
  variety: string;
  alphaAcids: string;
  aromaProfile: string;
  origin: string;
  growthVigor: 'moderate' | 'vigorous' | 'extreme';
  expectedYieldGrams: number;
  floweringDays: number;
  description: string;
}

export const HOP_CULTIVARS: HopCultivarProfile[] = [
  {
    name: 'Cascade Hops',
    variety: 'Cascade (USDA 56013)',
    alphaAcids: '5.5 - 7.5%',
    aromaProfile: 'Iconic American Pale Ale: Bright ruby grapefruit, floral citrus blossom, and fresh evergreen pine.',
    origin: 'Oregon / USDA Breeding Program',
    growthVigor: 'vigorous',
    expectedYieldGrams: 360,
    floweringDays: 45,
    description: 'The legendary hop that birthed the modern craft beer revolution. Vigorous climbing bines covered in tight pale-green strobiles with aromatic lupulin.'
  },
  {
    name: 'Centennial Hops',
    variety: 'Centennial ("Super Cascade")',
    alphaAcids: '9.5 - 11.5%',
    aromaProfile: 'Pungent lemon oil, clean floral notes, and resinous forest pine.',
    origin: 'Washington State',
    growthVigor: 'vigorous',
    expectedYieldGrams: 400,
    floweringDays: 48,
    description: 'Revered as "Super Cascade" for its higher alpha acid bittering punch and lush lemon-citrus aromatics. Prolific grower on 16-foot trellises.'
  },
  {
    name: 'Citra Hops',
    variety: 'Citra (HBC 394)',
    alphaAcids: '11.0 - 13.5%',
    aromaProfile: 'Tropical juice explosion: Sweet ripe mango, passionfruit, pink guava, lychee, and fresh lime zest.',
    origin: 'Yakima Valley, WA',
    growthVigor: 'extreme',
    expectedYieldGrams: 440,
    floweringDays: 52,
    description: 'The undisputed king of hazy New England IPAs. Loaded with massive golden lupulin glands and tropical essential oils.'
  },
  {
    name: 'Chinook Hops',
    variety: 'Chinook (USDA 21227)',
    alphaAcids: '12.0 - 14.0%',
    aromaProfile: 'Bold pine forest, resinous woodspice, earthy herbal character, and bitter red grapefruit.',
    origin: 'Yakima Valley, WA',
    growthVigor: 'extreme',
    expectedYieldGrams: 460,
    floweringDays: 50,
    description: 'An aggressive, hardy bine capable of growing up to a foot a day in peak summer. Heavy cone yields packed with resinous bittering oils.'
  },
  {
    name: 'Saaz Hops',
    variety: 'Czech Saaz (Žatec Noble)',
    alphaAcids: '3.0 - 4.5%',
    aromaProfile: 'Delicate noble bouquet: Warm pleasant spice, herbal meadow wildflowers, and soft earthy undertones.',
    origin: 'Bohemia, Czech Republic',
    growthVigor: 'moderate',
    expectedYieldGrams: 280,
    floweringDays: 42,
    description: 'The definitive noble hop behind authentic Bohemian Pilsners. Subtle, delicate papery cones with low bittering and world-class aroma.'
  },
  {
    name: 'Amarillo Hops',
    variety: 'Amarillo (VGXP01)',
    alphaAcids: '8.0 - 11.0%',
    aromaProfile: 'Valencia orange zest, sweet apricot marmalade, floral blossoms, and ripe summer peach.',
    origin: 'Virgil Gamache Farms, WA',
    growthVigor: 'vigorous',
    expectedYieldGrams: 370,
    floweringDays: 46,
    description: 'Prized for its distinct high-myrcene sweet orange oil signature that gives craft ales a sunny, citrusy character.'
  }
];

export interface PepperCultivarProfile {
  name: string;
  variety: string;
  scientificName: string;
  scovilleHeatUnits: number;
  scovilleRating: string;
  heatLevel: 'sweet' | 'mild' | 'medium' | 'hot' | 'superhot';
  heatBadgeColor: string;
  germinationDaysExpected: number;
  seedlingDaysExpected: number;
  matureSeedlingDaysExpected: number;
  vegetativeDaysExpected: number;
  floweringDaysExpected: number;
  ripeningDaysExpected: number;
  optimalGerminationTempF: number;
  minGerminationTempF: number;
  description: string;
  origin: string;
  expectedYieldGrams: number;
}

export const PEPPER_CULTIVARS: PepperCultivarProfile[] = [
  {
    name: 'Jalapeño',
    variety: 'Early Jalapeño (Capsicum annuum)',
    scientificName: 'Capsicum annuum',
    scovilleHeatUnits: 5000,
    scovilleRating: '2,500 - 8,000 SHU',
    heatLevel: 'medium',
    heatBadgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-700',
    germinationDaysExpected: 8,
    seedlingDaysExpected: 8,
    matureSeedlingDaysExpected: 10,
    vegetativeDaysExpected: 26,
    floweringDaysExpected: 42,
    ripeningDaysExpected: 14,
    optimalGerminationTempF: 80,
    minGerminationTempF: 70,
    description: 'Thick-walled, crisp green chili with classic zesty vegetable warmth. Excellent for fresh salsa, pickling, and poppers.',
    origin: 'Xalapa, Veracruz, Mexico',
    expectedYieldGrams: 420
  },
  {
    name: 'Habanero',
    variety: 'Orange Habanero (Capsicum chinense)',
    scientificName: 'Capsicum chinense',
    scovilleHeatUnits: 250000,
    scovilleRating: '150,000 - 325,000 SHU',
    heatLevel: 'hot',
    heatBadgeColor: 'bg-orange-950 text-orange-300 border-orange-700',
    germinationDaysExpected: 16,
    seedlingDaysExpected: 10,
    matureSeedlingDaysExpected: 12,
    vegetativeDaysExpected: 32,
    floweringDaysExpected: 52,
    ripeningDaysExpected: 16,
    optimalGerminationTempF: 84,
    minGerminationTempF: 74,
    description: 'Lantern-shaped orange pods bursting with tropical floral apricot fragrance and a searing, lingering heat wave. Requires warm seedbeds to germinate.',
    origin: 'Amazon Basin / Yucatán, Mexico',
    expectedYieldGrams: 340
  },
  {
    name: 'Ghost Pepper (Bhut Jolokia)',
    variety: 'Bhut Jolokia (Capsicum chinense)',
    scientificName: 'Capsicum chinense',
    scovilleHeatUnits: 1000000,
    scovilleRating: '855,000 - 1,041,427 SHU',
    heatLevel: 'superhot',
    heatBadgeColor: 'bg-rose-950 text-rose-300 border-rose-700',
    germinationDaysExpected: 22,
    seedlingDaysExpected: 12,
    matureSeedlingDaysExpected: 14,
    vegetativeDaysExpected: 35,
    floweringDaysExpected: 60,
    ripeningDaysExpected: 20,
    optimalGerminationTempF: 85,
    minGerminationTempF: 76,
    description: 'Legendary Indian superhot with rough, dented scarlet skin. Notoriously slow germination (3-4 weeks) that demands consistent 82-86°F heat mat warmth.',
    origin: 'Assam, Northeast India',
    expectedYieldGrams: 300
  },
  {
    name: 'Carolina Reaper',
    variety: 'Carolina Reaper (HP22B)',
    scientificName: 'Capsicum chinense',
    scovilleHeatUnits: 1641000,
    scovilleRating: '1,500,000 - 2,200,000 SHU',
    heatLevel: 'superhot',
    heatBadgeColor: 'bg-red-950 text-red-300 border-red-700',
    germinationDaysExpected: 26,
    seedlingDaysExpected: 14,
    matureSeedlingDaysExpected: 14,
    vegetativeDaysExpected: 38,
    floweringDaysExpected: 65,
    ripeningDaysExpected: 22,
    optimalGerminationTempF: 86,
    minGerminationTempF: 78,
    description: 'Guinness World Record fiery superhot featuring bumpy crimson skin and distinctive scorpion tail. Demands dedicated bottom heat and patience during germination.',
    origin: 'Fort Mill, South Carolina',
    expectedYieldGrams: 280
  },
  {
    name: 'Cayenne Pepper',
    variety: 'Long Slim Red Cayenne (Capsicum annuum)',
    scientificName: 'Capsicum annuum',
    scovilleHeatUnits: 40000,
    scovilleRating: '30,000 - 50,000 SHU',
    heatLevel: 'medium',
    heatBadgeColor: 'bg-amber-950 text-amber-300 border-amber-700',
    germinationDaysExpected: 9,
    seedlingDaysExpected: 8,
    matureSeedlingDaysExpected: 10,
    vegetativeDaysExpected: 26,
    floweringDaysExpected: 44,
    ripeningDaysExpected: 14,
    optimalGerminationTempF: 80,
    minGerminationTempF: 70,
    description: 'Slender, twisting 6-inch red chilis with vibrant pungent heat. Fast germinator, heavy yields, perfect for crushing into chili flakes or hot sauces.',
    origin: 'French Guiana / Cayenne',
    expectedYieldGrams: 380
  },
  {
    name: 'Serrano Pepper',
    variety: 'Serrano del Sol (Capsicum annuum)',
    scientificName: 'Capsicum annuum',
    scovilleHeatUnits: 18000,
    scovilleRating: '10,000 - 23,000 SHU',
    heatLevel: 'medium',
    heatBadgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-700',
    germinationDaysExpected: 9,
    seedlingDaysExpected: 8,
    matureSeedlingDaysExpected: 10,
    vegetativeDaysExpected: 28,
    floweringDaysExpected: 46,
    ripeningDaysExpected: 14,
    optimalGerminationTempF: 80,
    minGerminationTempF: 70,
    description: 'Crisp cylindrical pepper with noticeably brighter, punchier kick than Jalapeño. Prolific branching plant producing up to 50 pods.',
    origin: 'Puebla & Hidalgo, Mexico',
    expectedYieldGrams: 400
  },
  {
    name: 'Poblano / Ancho',
    variety: 'Poblano (Capsicum annuum)',
    scientificName: 'Capsicum annuum',
    scovilleHeatUnits: 1500,
    scovilleRating: '1,000 - 2,000 SHU',
    heatLevel: 'mild',
    heatBadgeColor: 'bg-teal-950 text-teal-300 border-teal-700',
    germinationDaysExpected: 10,
    seedlingDaysExpected: 9,
    matureSeedlingDaysExpected: 10,
    vegetativeDaysExpected: 28,
    floweringDaysExpected: 48,
    ripeningDaysExpected: 15,
    optimalGerminationTempF: 80,
    minGerminationTempF: 70,
    description: 'Large, heart-shaped glossy dark green pod with rich, mild earthy heat. When dried called Ancho. The quintessential pepper for chiles rellenos.',
    origin: 'Puebla, Mexico',
    expectedYieldGrams: 520
  },
  {
    name: 'California Wonder Bell Pepper',
    variety: 'California Wonder (Capsicum annuum)',
    scientificName: 'Capsicum annuum',
    scovilleHeatUnits: 0,
    scovilleRating: '0 SHU (Sweet)',
    heatLevel: 'sweet',
    heatBadgeColor: 'bg-blue-950 text-blue-300 border-blue-700',
    germinationDaysExpected: 7,
    seedlingDaysExpected: 8,
    matureSeedlingDaysExpected: 10,
    vegetativeDaysExpected: 24,
    floweringDaysExpected: 40,
    ripeningDaysExpected: 12,
    optimalGerminationTempF: 78,
    minGerminationTempF: 68,
    description: 'Classic blocky 4-lobed sweet bell pepper with thick, sweet juicy walls. Quick reliable germination and high vitamin C content.',
    origin: 'California, USA',
    expectedYieldGrams: 600
  },
  {
    name: 'Thai Bird\'s Eye Chili',
    variety: 'Thai Dragon (Capsicum frutescens)',
    scientificName: 'Capsicum frutescens',
    scovilleHeatUnits: 75000,
    scovilleRating: '50,000 - 100,000 SHU',
    heatLevel: 'hot',
    heatBadgeColor: 'bg-red-950 text-red-300 border-red-700',
    germinationDaysExpected: 12,
    seedlingDaysExpected: 9,
    matureSeedlingDaysExpected: 10,
    vegetativeDaysExpected: 28,
    floweringDaysExpected: 48,
    ripeningDaysExpected: 15,
    optimalGerminationTempF: 82,
    minGerminationTempF: 72,
    description: 'Prolific bushy plant loaded with clusters of tiny upright-pointing chilis packing immediate, sharp fire. Fundamental to authentic Southeast Asian cuisine.',
    origin: 'Thailand & Southeast Asia',
    expectedYieldGrams: 310
  }
];

export function getPepperCultivar(nameOrVariety?: string): PepperCultivarProfile | undefined {
  if (!nameOrVariety) return undefined;
  const lower = nameOrVariety.toLowerCase();
  return PEPPER_CULTIVARS.find(p => 
    lower.includes(p.name.toLowerCase()) || 
    p.name.toLowerCase().includes(lower) || 
    lower.includes(p.variety.toLowerCase()) ||
    p.variety.toLowerCase().includes(lower)
  );
}

/**
 * Returns the next lifecycle stage when transitioning
 */
export function getNextPlantStage(current: PlantStage, origin: PropagationType): PlantStage {
  switch (current) {
    case 'germination':
      return 'seedling';
    case 'rooting':
      return 'seedling';
    case 'seedling':
      return 'mature_seedling';
    case 'mature_seedling':
      return 'vegetative';
    case 'vegetative':
      return 'flowering';
    case 'flowering':
      return 'ripening';
    case 'ripening':
      return 'ready';
    case 'ready':
      return 'ready';
    default:
      return 'vegetative';
  }
}

/**
 * Formats a timestamp into human-readable date and time
 */
export function formatSimDateTime(timestamp?: number): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Formats a timestamp into short date (e.g. "Aug 20, 2026")
 */
export function formatSimDateShort(timestamp?: number): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
