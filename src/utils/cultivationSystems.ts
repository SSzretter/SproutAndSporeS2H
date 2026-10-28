import { CultivationSystemType, ContainerType, GrowingMedium } from '../types/sim';

/**
 * Which container vessels and growing media physically work with each cultivation system.
 * The first entry of each list is the system's default.
 */
export const SYSTEM_COMPATIBILITY: Record<CultivationSystemType, { containers: ContainerType[]; media: GrowingMedium[] }> = {
  soil_container: {
    containers: ['fabric_pot', 'plastic_nursery_pot', 'terracotta_pot'],
    media: ['living_organic_soil', 'coco_perlite', 'peat_potting_mix']
  },
  raised_bed: {
    containers: ['raised_bed_cedar'],
    media: ['living_organic_soil', 'peat_potting_mix', 'native_garden_loam']
  },
  in_ground: {
    containers: ['in_ground_earth'],
    media: ['native_garden_loam', 'living_organic_soil']
  },
  dwc: {
    containers: ['dwc_reservoir_bucket'],
    media: ['hydroton_clay_pebbles', 'rockwool_cubes']
  },
  // Plants sit in the flood tray directly or in plastic pots of inert media on the table
  ebb_and_flow: {
    containers: ['flood_drain_tray', 'plastic_nursery_pot'],
    media: ['hydroton_clay_pebbles', 'rockwool_cubes', 'coco_perlite']
  },
  // Drippers feed pots or slabs; runoff drains to a tray
  drip_hydro: {
    containers: ['plastic_nursery_pot', 'fabric_pot', 'flood_drain_tray'],
    media: ['coco_perlite', 'rockwool_cubes', 'hydroton_clay_pebbles']
  },
  aeroponics: {
    containers: ['aeroponic_chamber'],
    media: ['aeroponic_mist']
  },
  // A pot over a reservoir, fed through a wick: needs a medium that wicks well
  wick_system: {
    containers: ['plastic_nursery_pot', 'terracotta_pot'],
    media: ['coco_perlite', 'peat_potting_mix']
  }
};

export function getCompatibleContainers(system: CultivationSystemType): ContainerType[] {
  return SYSTEM_COMPATIBILITY[system]?.containers ?? SYSTEM_COMPATIBILITY.soil_container.containers;
}

export function getCompatibleMedia(system: CultivationSystemType): GrowingMedium[] {
  return SYSTEM_COMPATIBILITY[system]?.media ?? SYSTEM_COMPATIBILITY.soil_container.media;
}
