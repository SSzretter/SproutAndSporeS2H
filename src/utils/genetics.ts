import { PlantSpecies, MushroomSpecies, PropagationType } from '../types/sim';

export interface SeedGeneticTraits {
  seedId: string; // e.g. "GG4-S7-941"
  viabilityPct: number; // 60 - 99% (likelihood of successful germination)
  germinationVigor: number; // 0.70x - 1.35x (speed of radicle emergence and cotyledon push)
  growthRateMultiplier: number; // 0.78x - 1.28x (daily vegetative & flowering progression speed)
  yieldMultiplier: number; // 0.80x - 1.30x (final harvest flower/fruit mass)
  pestMoldResistance: 'fragile' | 'moderate' | 'hardy' | 'resilient';
  nutrientEfficiency: number; // 0.80x - 1.25x (tolerance to hot EC salts and absorption efficiency)
  terpeneResinPotential: number; // 0.85x - 1.35x (essential oils, aroma, alpha acids, capsaicin)
  germinationOutcome: 'germinated' | 'dormant' | 'failed' | 'in_progress';
  phenotypeName: string; // e.g. "Heavy Branching Purple Calyx Pheno"
  generation: 'F1 Hybrid' | 'F2 Polyhybrid' | 'Landrace Heirloom' | 'S1 Inbred' | 'Tissue Culture Clone';
  seedGrade: 'Certified High-Viability' | 'Standard Breeder Pack' | 'Exotic Wildcraft';
  daysInGermination?: number;
  failureReason?: string;
}

export interface SporeGeneticTraits {
  sporeBatchId: string; // e.g. "LM-SP-382"
  viabilityPct: number; // 65 - 98% (spore germination & hyphal anastomosing success rate)
  colonizationVigor: number; // 0.75x - 1.35x (speed mycelium consolidates the substrate)
  pinningDensity: 'sparse' | 'moderate' | 'dense' | 'prolific';
  flushYieldMultiplier: number; // 0.80x - 1.30x
  contaminationResistance: 'vulnerable' | 'moderate' | 'aggressive' | 'impervious';
  co2Tolerance: number; // 0.80x - 1.25x (tolerance to elevated CO2 before leggy stems form)
  sporeViabilityOutcome: 'germinated' | 'dormant' | 'failed' | 'in_progress';
  phenotypeName: string; // e.g. "Aggressive Rhizomorphic Cluster Inoculant"
  inoculantType: 'Multi-Spore Syringe (MSS)' | 'Isolated Liquid Culture (LC)' | 'Clean Agar Sector' | 'Grain Master Spawn';
  inoculantGrade: 'Isolated Commercial LC' | 'Multi-Spore Syringe' | 'Wild Spore Print';
  daysInColonization?: number;
  failureReason?: string;
}

// Random helper between min and max
function randomBetween(min: number, max: number, decimals: number = 2): number {
  const val = min + Math.random() * (max - min);
  return parseFloat(val.toFixed(decimals));
}

// Generate realistic Seed Genetic Traits with natural genetic bell curve
export function generateSeedTraits(
  species: PlantSpecies,
  strainName: string,
  propagationType: PropagationType = 'seed',
  grade: 'Certified High-Viability' | 'Standard Breeder Pack' | 'Exotic Wildcraft' = 'Certified High-Viability'
): SeedGeneticTraits {
  const seedNum = Math.floor(100 + Math.random() * 900);
  const cleanPrefix = strainName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SEED';
  const seedId = `${cleanPrefix}-${propagationType === 'cutting' ? 'CL' : 'SD'}${seedNum}`;

  // Viability range according to grade
  let minViab = 88;
  let maxViab = 99;
  if (grade === 'Standard Breeder Pack') {
    minViab = 75;
    maxViab = 96;
  } else if (grade === 'Exotic Wildcraft') {
    minViab = 60;
    maxViab = 92;
  }

  // Cuttings have root strike viability instead of seed coat viability
  const viabilityPct = propagationType === 'cutting'
    ? Math.round(randomBetween(85, 99, 0))
    : Math.round(randomBetween(minViab, maxViab, 0));

  const germinationVigor = randomBetween(0.80, 1.32, 2);
  const growthRateMultiplier = randomBetween(0.82, 1.26, 2);
  const yieldMultiplier = randomBetween(0.82, 1.28, 2);
  const nutrientEfficiency = randomBetween(0.85, 1.22, 2);
  const terpeneResinPotential = randomBetween(0.88, 1.32, 2);

  // Mold resistance distribution
  const rollResist = Math.random();
  let pestMoldResistance: SeedGeneticTraits['pestMoldResistance'] = 'moderate';
  if (rollResist > 0.8) pestMoldResistance = 'resilient';
  else if (rollResist > 0.45) pestMoldResistance = 'hardy';
  else if (rollResist < 0.15) pestMoldResistance = 'fragile';

  // Phenotype name generator based on species and vigor
  let phenotypeName = 'Standard Balanced Phenotype';
  if (species === 'Cannabis') {
    if (terpeneResinPotential > 1.2) phenotypeName = 'Frost Queen (Heavy Trichome Resin Pheno)';
    else if (growthRateMultiplier > 1.15) phenotypeName = 'Vigorous Branching Pheno #4';
    else if (yieldMultiplier > 1.18) phenotypeName = 'Heavy Colas / Dense Calyx Pheno';
    else if (growthRateMultiplier < 0.92) phenotypeName = 'Compact Indica Dwarf Pheno';
    else phenotypeName = 'Sweet Terpene / Balanced Hybrid Pheno';
  } else if (species === 'Hops') {
    if (terpeneResinPotential > 1.18) phenotypeName = 'High-Alpha Resinous Cone Pheno';
    else if (growthRateMultiplier > 1.15) phenotypeName = 'Vigorous 16ft Climber Pheno';
    else phenotypeName = 'Aromatic Lupulin Cluster Pheno';
  } else if (species === 'Chili Pepper') {
    if (terpeneResinPotential > 1.2) phenotypeName = 'Scoville Fire Bomb (Heavy Placenta Heat)';
    else if (yieldMultiplier > 1.15) phenotypeName = 'Prolific Pod Cluster Pheno';
    else phenotypeName = 'Crisp Thick-Walled Fruit Pheno';
  } else if (species === 'Tomato') {
    if (yieldMultiplier > 1.18) phenotypeName = 'Heavy Cluster Beefsteak Pheno';
    else if (terpeneResinPotential > 1.15) phenotypeName = 'High-Brix Rich Flavor Pheno';
    else phenotypeName = 'Indeterminate Climbing Vine Pheno';
  } else {
    phenotypeName = 'High Essential Oil Leaf Pheno';
  }

  // Generation
  const generation: SeedGeneticTraits['generation'] = 
    propagationType === 'cutting' 
      ? 'Tissue Culture Clone' 
      : grade === 'Certified High-Viability' 
        ? 'F1 Hybrid' 
        : grade === 'Exotic Wildcraft' 
          ? 'Landrace Heirloom' 
          : 'F2 Polyhybrid';

  return {
    seedId,
    viabilityPct,
    germinationVigor,
    growthRateMultiplier,
    yieldMultiplier,
    pestMoldResistance,
    nutrientEfficiency,
    terpeneResinPotential,
    germinationOutcome: 'in_progress',
    phenotypeName,
    generation,
    seedGrade: grade,
    daysInGermination: 0
  };
}

// Generate realistic Spore Genetic Traits
export function generateSporeTraits(
  species: MushroomSpecies,
  strainName: string,
  grade: 'Isolated Commercial LC' | 'Multi-Spore Syringe' | 'Wild Spore Print' = 'Isolated Commercial LC'
): SporeGeneticTraits {
  const sporeNum = Math.floor(100 + Math.random() * 900);
  const cleanPrefix = species.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SHRM';
  const sporeBatchId = `${cleanPrefix}-SP${sporeNum}`;

  let minViab = 88;
  let maxViab = 98;
  if (grade === 'Multi-Spore Syringe') {
    minViab = 72;
    maxViab = 94;
  } else if (grade === 'Wild Spore Print') {
    minViab = 60;
    maxViab = 88;
  }

  const viabilityPct = Math.round(randomBetween(minViab, maxViab, 0));
  const colonizationVigor = randomBetween(0.78, 1.34, 2);
  const flushYieldMultiplier = randomBetween(0.82, 1.28, 2);
  const co2Tolerance = randomBetween(0.80, 1.25, 2);

  // Pinning density
  const rollPin = Math.random();
  let pinningDensity: SporeGeneticTraits['pinningDensity'] = 'moderate';
  if (rollPin > 0.8) pinningDensity = 'prolific';
  else if (rollPin > 0.45) pinningDensity = 'dense';
  else if (rollPin < 0.15) pinningDensity = 'sparse';

  // Contamination resistance
  const rollContam = Math.random();
  let contaminationResistance: SporeGeneticTraits['contaminationResistance'] = 'moderate';
  if (rollContam > 0.8) contaminationResistance = 'impervious';
  else if (rollContam > 0.45) contaminationResistance = 'aggressive';
  else if (rollContam < 0.15) contaminationResistance = 'vulnerable';

  // Inoculant type
  const inoculantType: SporeGeneticTraits['inoculantType'] = 
    grade === 'Isolated Commercial LC' 
      ? 'Isolated Liquid Culture (LC)' 
      : grade === 'Wild Spore Print' 
        ? 'Clean Agar Sector' 
        : 'Multi-Spore Syringe (MSS)';

  let phenotypeName = 'Fast Rhizomorphic Strain';
  if (colonizationVigor > 1.18 && pinningDensity === 'prolific') {
    phenotypeName = 'Aggressive Rhizomorphic Cluster Inoculant';
  } else if (colonizationVigor > 1.15) {
    phenotypeName = 'Heavy Cord Network Mycelium';
  } else if (flushYieldMultiplier > 1.18) {
    phenotypeName = 'Giant Fruiting Flush Phenotype';
  } else if (colonizationVigor < 0.90) {
    phenotypeName = 'Fluffy Tomentose Phenotype (Slow Consolidator)';
  } else {
    phenotypeName = 'Balanced Commercial Flush Isolate';
  }

  return {
    sporeBatchId,
    viabilityPct,
    colonizationVigor,
    pinningDensity,
    flushYieldMultiplier,
    contaminationResistance,
    co2Tolerance,
    sporeViabilityOutcome: 'in_progress',
    phenotypeName,
    inoculantType,
    inoculantGrade: grade,
    daysInColonization: 0
  };
}

// Calculate an overall letter tier for the genetic profile
export function getGeneticTier(vigor: number, viability: number, yieldMult: number): {
  tier: 'S+' | 'S' | 'A' | 'B' | 'C';
  label: string;
  badgeColor: string;
} {
  const score = (vigor * 35) + (viability * 0.4) + (yieldMult * 25);
  if (score >= 108) {
    return {
      tier: 'S+',
      label: 'Elite Keeper Phenotype',
      badgeColor: 'bg-amber-950 text-amber-300 border-amber-600 shadow-amber-950/40'
    };
  }
  if (score >= 98) {
    return {
      tier: 'S',
      label: 'Exceptional Vigor',
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-emerald-950/40'
    };
  }
  if (score >= 88) {
    return {
      tier: 'A',
      label: 'Prime Commercial Vigor',
      badgeColor: 'bg-teal-950 text-teal-300 border-teal-600'
    };
  }
  if (score >= 76) {
    return {
      tier: 'B',
      label: 'Standard Viability',
      badgeColor: 'bg-sky-950 text-sky-300 border-sky-700'
    };
  }
  return {
    tier: 'C',
    label: 'Marginal / High Care Needed',
    badgeColor: 'bg-rose-950 text-rose-300 border-rose-800'
  };
}
