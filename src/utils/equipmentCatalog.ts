import { Dimensions, EquipmentItem, InlineFanDuctSize } from '../types/sim';

/** Inline (exhaust) duct fan models by duct / port diameter. */
export const INLINE_FAN_SPECS: Record<InlineFanDuctSize, { name: string; watts: number; cfm: number; dimensions: Dimensions }> = {
  4: { name: '4" EC Inline Duct Fan', watts: 20, cfm: 205, dimensions: { length: 1.0, width: 0.55, height: 0.55, unit: 'ft' } },
  6: { name: '6" EC Inline Duct Fan', watts: 38, cfm: 402, dimensions: { length: 1.2, width: 0.8, height: 0.8, unit: 'ft' } }
};

export const INLINE_FAN_DUCT_SIZES: InlineFanDuctSize[] = [4, 6];

/** Duct size for fans saved before the option existed: read it from the name, else assume 6". */
export function inferInlineFanDuctSize(eq: EquipmentItem): InlineFanDuctSize {
  return /(^|\D)4\s*("|”|in\b|-inch|inch)/i.test(eq.name) ? 4 : 6;
}
