import { Tent } from '../types/sim';

/**
 * Thermal envelope of a grow tent from its construction (`mylarRating` + brand).
 *
 * A tent wall is one thin fabric layer, so almost all of its insulation comes from the still-air
 * films on either side (~R-0.7 each). What actually changes between tents:
 * - A reflective mylar liner cuts radiant exchange, roughly doubling the inside film's resistance.
 * - Heavier fabric (higher denier) adds a little resistance and holds its shape (fewer gaps).
 * - Seal quality: zippers, light-proof flaps and cinch ports. Budget tents leak far more air.
 * - Insulated thermal tents (foam / quilted walls) are in a different class altogether.
 */
export interface TentEnvelope {
  uValue: number; // BTU/h·ft²·°F through the walls, roof and floor
  leakAch: number; // passive air changes per hour with the fan off
  label: string;
}

/** Fabric grades offered when editing a tent, from budget to insulated. */
export const TENT_FABRIC_OPTIONS = [
  '210D Polyester Mylar',
  '600D Oxford Mylar',
  '1680D Oxford Reflective Mylar',
  '1680D Thread Count Diamond Mylar',
  '2000D Diamond Mylar',
  'Non-Reflective Canvas',
  'Insulated Thermal Tent'
];

export function getTentEnvelope(tent: Pick<Tent, 'mylarRating' | 'brand'>): TentEnvelope {
  const rating = (tent.mylarRating || '600D Mylar').toLowerCase();
  const denier = Number(rating.match(/(\d+)\s*d\b/)?.[1] ?? 600);

  if (rating.includes('insulat') || rating.includes('thermal')) {
    return { uValue: 0.4, leakAch: 1.0, label: 'Insulated thermal walls' };
  }

  const reflective = rating.includes('mylar') || rating.includes('reflective') || rating.includes('diamond');
  // Reflective liner: ~R-1.0 total; bare fabric: ~R-0.8. Heavier fabric adds a little.
  const denierBonus = 0.06 * Math.min(1, Math.max(0, (denier - 210) / (2000 - 210)));
  const uValue = (reflective ? 1.0 : 1.2) - denierBonus;

  // Seal quality: premium brands' zippers, double flaps and cinch ports vs. budget seams
  const premium = tent.brand === 'AC Infinity' || tent.brand === 'Gorilla Grow';
  const leakAch = premium || denier >= 2000 ? 1.5 : denier >= 1680 ? 2.0 : denier >= 600 ? 3.0 : 4.5;

  const quality = leakAch <= 1.5 ? 'premium seals' : leakAch <= 2 ? 'good seals' : leakAch <= 3 ? 'average seals' : 'budget, leaky seams';
  return { uValue: Math.round(uValue * 100) / 100, leakAch, label: `${reflective ? 'Reflective liner' : 'Bare fabric'}, ${quality}` };
}
