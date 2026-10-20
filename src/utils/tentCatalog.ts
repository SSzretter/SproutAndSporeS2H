import { Dimensions, TentBrand } from '../types/sim';

export interface CatalogTentModel {
  id: string;
  brand: TentBrand;
  modelName: string;
  shortCode: string;
  dimensions: Dimensions;
  dimensionsInches: string;
  mylarRating: string;
  poleDiameter: string;
  ventPorts: string;
  weightCapacityLbs: number;
  description: string;
  recommendedUse: string;
  iconColor: string;
}

export const TENT_CATALOG: CatalogTentModel[] = [
  // AC INFINITY CLOUDLAB SERIES
  {
    id: 'aci-cloudlab-422',
    brand: 'AC Infinity',
    modelName: 'CLOUDLAB 422',
    shortCode: '2x2x4',
    dimensions: { length: 2.0, width: 2.0, height: 4.0, unit: 'ft' },
    dimensionsInches: '24" × 24" × 48"',
    mylarRating: '2000D Diamond Mylar',
    poleDiameter: '22mm Steel Poles',
    ventPorts: 'Dual 4" & 6" Cinch Ports',
    weightCapacityLbs: 150,
    description: 'Compact personal tent featuring high-density 2000D diamond mylar and 22mm steel frame.',
    recommendedUse: 'Seedling Nursery, Mother Plant, or Microgreens',
    iconColor: 'text-sky-400'
  },
  {
    id: 'aci-cloudlab-632',
    brand: 'AC Infinity',
    modelName: 'CLOUDLAB 632',
    shortCode: '3x3x6',
    dimensions: { length: 3.0, width: 3.0, height: 6.0, unit: 'ft' },
    dimensionsInches: '36" × 36" × 72"',
    mylarRating: '2000D Diamond Mylar',
    poleDiameter: '22mm Steel Poles',
    ventPorts: 'Dual 6" & 8" Cinch Ports',
    weightCapacityLbs: 150,
    description: 'Balanced square footprint popular for 1-3 medium plants or Martha mushroom fruiting chambers.',
    recommendedUse: 'Mushroom Martha Chamber or 2-Plant Flora',
    iconColor: 'text-sky-400'
  },
  {
    id: 'aci-cloudlab-722',
    brand: 'AC Infinity',
    modelName: 'CLOUDLAB 722',
    shortCode: '2x4x6',
    dimensions: { length: 2.0, width: 4.0, height: 6.0, unit: 'ft' },
    dimensionsInches: '24" × 48" × 72"',
    mylarRating: '2000D Diamond Mylar',
    poleDiameter: '22mm Steel Poles',
    ventPorts: 'Dual 6" Cinch Ports',
    weightCapacityLbs: 150,
    description: 'Shallow rectangular profile engineered to slot cleanly against room walls and bedroom closets.',
    recommendedUse: 'Closet Veg / Flowering Lineup',
    iconColor: 'text-sky-400'
  },
  {
    id: 'aci-cloudlab-733',
    brand: 'AC Infinity',
    modelName: 'CLOUDLAB 733',
    shortCode: '3x2x3',
    dimensions: { length: 3.0, width: 2.0, height: 3.0, unit: 'ft' },
    dimensionsInches: '36" × 24" × 36"',
    mylarRating: '2000D Diamond Mylar',
    poleDiameter: '22mm Steel Poles',
    ventPorts: 'Dual 4" Cinch Ports',
    weightCapacityLbs: 120,
    description: 'Low-profile shelf and tabletop cultivation enclosure with observation window.',
    recommendedUse: 'Clones, Inoculated Jars, Seed Trays',
    iconColor: 'text-sky-400'
  },
  {
    id: 'aci-cloudlab-844',
    brand: 'AC Infinity',
    modelName: 'CLOUDLAB 844',
    shortCode: '4x4x6.7',
    dimensions: { length: 4.0, width: 4.0, height: 6.7, unit: 'ft' },
    dimensionsInches: '48" × 48" × 80"',
    mylarRating: '2000D Diamond Mylar',
    poleDiameter: '22mm Steel Poles',
    ventPorts: 'Dual 6", 8" & 10" Cinch Ports',
    weightCapacityLbs: 150,
    description: 'The golden standard 4x4 grow tent with controller mounting plate and heavy-duty SBS zippers.',
    recommendedUse: 'Full-Cycle Flowering Canopy (4-6 Plants)',
    iconColor: 'text-sky-400'
  },
  {
    id: 'aci-cloudlab-864',
    brand: 'AC Infinity',
    modelName: 'CLOUDLAB 864',
    shortCode: '5x5x6.7',
    dimensions: { length: 5.0, width: 5.0, height: 6.7, unit: 'ft' },
    dimensionsInches: '60" × 60" × 80"',
    mylarRating: '2000D Diamond Mylar',
    poleDiameter: '22mm Steel Poles',
    ventPorts: 'Dual 6", 8" & 10" Cinch Ports',
    weightCapacityLbs: 180,
    description: 'High capacity 25 sq ft floor area suited for massive commercial LED bar arrays.',
    recommendedUse: 'High-Yield Commercial Flora & Veg',
    iconColor: 'text-sky-400'
  },
  {
    id: 'aci-cloudlab-894',
    brand: 'AC Infinity',
    modelName: 'CLOUDLAB 894',
    shortCode: '4x8x6.7',
    dimensions: { length: 8.0, width: 4.0, height: 6.7, unit: 'ft' },
    dimensionsInches: '96" × 48" × 80"',
    mylarRating: '2000D Diamond Mylar',
    poleDiameter: '22mm Steel Poles',
    ventPorts: 'Quad 8" & 10" Cinch Ports',
    weightCapacityLbs: 300,
    description: 'Double 4x4 continuous chamber with central support partition and dual side doors.',
    recommendedUse: 'Large Production Perpetual Harvest',
    iconColor: 'text-sky-400'
  },
  {
    id: 'aci-advance-2in1',
    brand: 'AC Infinity',
    modelName: 'ADVANCE 2-in-1 Dual Chamber',
    shortCode: '3x2x5',
    dimensions: { length: 3.0, width: 2.0, height: 5.0, unit: 'ft' },
    dimensionsInches: '36" × 24" × 60"',
    mylarRating: '2000D Diamond Mylar',
    poleDiameter: '22mm Steel Poles',
    ventPorts: 'Multiple 4" & 6" Cinch Ports',
    weightCapacityLbs: 150,
    description: 'Partitioned interior: 2-tier nursery / seedling chamber on left, flowering section on right.',
    recommendedUse: 'Perpetual Dual-Zone Breeding / Nursery',
    iconColor: 'text-sky-400'
  },

  // SPIDER FARMER SERIES
  {
    id: 'sf-tent-2x2',
    brand: 'Spider Farmer',
    modelName: 'SF-2x2 Grow Tent',
    shortCode: '2x2x4.6',
    dimensions: { length: 2.0, width: 2.0, height: 4.6, unit: 'ft' },
    dimensionsInches: '24" × 24" × 55"',
    mylarRating: '1680D Oxford Reflective Mylar',
    poleDiameter: '16mm Hardened Steel',
    ventPorts: 'Dual 4" & 6" Duct Ports',
    weightCapacityLbs: 110,
    description: 'Durable 1680D canvas tent tailored for SF1000 / SF1000D LED grow setups.',
    recommendedUse: 'Single High-Value Plant or Microgreens',
    iconColor: 'text-amber-400'
  },
  {
    id: 'sf-tent-2x4',
    brand: 'Spider Farmer',
    modelName: 'SF-2x4 Grow Tent',
    shortCode: '2x4x6',
    dimensions: { length: 2.0, width: 4.0, height: 6.0, unit: 'ft' },
    dimensionsInches: '24" × 48" × 71"',
    mylarRating: '1680D Oxford Reflective Mylar',
    poleDiameter: '19mm Steel Rods',
    ventPorts: 'Dual 6" & 8" Duct Ports',
    weightCapacityLbs: 140,
    description: 'Popular 2x4 footprint pairing seamlessly with SF2000 or G3000 bar lighting.',
    recommendedUse: '2-3 Medium Plants / Trellis Scrog',
    iconColor: 'text-amber-400'
  },
  {
    id: 'sf-tent-3x3',
    brand: 'Spider Farmer',
    modelName: 'SF-3x3 Grow Tent',
    shortCode: '3x3x6',
    dimensions: { length: 3.0, width: 3.0, height: 6.0, unit: 'ft' },
    dimensionsInches: '36" × 36" × 71"',
    mylarRating: '1680D Oxford Reflective Mylar',
    poleDiameter: '19mm Steel Rods',
    ventPorts: 'Dual 6" & 8" Duct Ports',
    weightCapacityLbs: 140,
    description: 'Square 9 sq ft chamber with viewing window and removable waterproof floor tray.',
    recommendedUse: 'SE3000 / G300W Flora or Mushroom Tubs',
    iconColor: 'text-amber-400'
  },
  {
    id: 'sf-tent-4x4',
    brand: 'Spider Farmer',
    modelName: 'SF-4x4 Pro Grow Tent',
    shortCode: '4x4x6.7',
    dimensions: { length: 4.0, width: 4.0, height: 6.7, unit: 'ft' },
    dimensionsInches: '48" × 48" × 80"',
    mylarRating: '1680D Oxford Reflective Mylar',
    poleDiameter: '22mm Heavy Duty Steel',
    ventPorts: 'Dual 6", 8" & 10" Duct Ports',
    weightCapacityLbs: 180,
    description: '16 sq ft workhorse tent equipped with smooth SBS zippers and observation window.',
    recommendedUse: 'SE5000 / G5000 4x4 Canopy Cultivation',
    iconColor: 'text-amber-400'
  },
  {
    id: 'sf-tent-5x5',
    brand: 'Spider Farmer',
    modelName: 'SF-5x5 Pro Grow Tent',
    shortCode: '5x5x6.7',
    dimensions: { length: 5.0, width: 5.0, height: 6.7, unit: 'ft' },
    dimensionsInches: '60" × 60" × 80"',
    mylarRating: '1680D Oxford Reflective Mylar',
    poleDiameter: '22mm Heavy Duty Steel',
    ventPorts: 'Quad 8" & 10" Duct Ports',
    weightCapacityLbs: 200,
    description: 'High headroom 25 sq ft canopy enclosure engineered for G8600 / SE7000 fixtures.',
    recommendedUse: 'Maximum Yield 5x5 Flower Harvest',
    iconColor: 'text-amber-400'
  },
  {
    id: 'sf-tent-2in1',
    brand: 'Spider Farmer',
    modelName: 'SF 2-in-1 Dual Chamber',
    shortCode: '4x3x6',
    dimensions: { length: 4.0, width: 3.0, height: 6.0, unit: 'ft' },
    dimensionsInches: '48" × 36" × 71"',
    mylarRating: '1680D Oxford Reflective Mylar',
    poleDiameter: '19mm Steel Rods',
    ventPorts: 'Multiple 4" & 6" Duct Ports',
    weightCapacityLbs: 150,
    description: '3 separate stations: 2-tier propagation/clone space plus a large dedicated flowering room.',
    recommendedUse: 'Continuous Harvest Cycle Nursery + Bloom',
    iconColor: 'text-amber-400'
  },
  {
    id: 'sf-tent-4x8',
    brand: 'Spider Farmer',
    modelName: 'SF-4x8 Commercial Tent',
    shortCode: '4x8x6.7',
    dimensions: { length: 8.0, width: 4.0, height: 6.7, unit: 'ft' },
    dimensionsInches: '96" × 48" × 80"',
    mylarRating: '1680D Oxford Reflective Mylar',
    poleDiameter: '22mm Heavy Duty Steel',
    ventPorts: 'Quad 8" & 10" Duct Ports',
    weightCapacityLbs: 300,
    description: 'Dual-access large format commercial tent with reinforced crossbars for heavy carbon filters.',
    recommendedUse: 'Double 4x4 Commercial Production',
    iconColor: 'text-amber-400'
  },

  // GORILLA GROW TENT
  {
    id: 'gorilla-ggt-4x4',
    brand: 'Gorilla Grow',
    modelName: 'Gorilla GGT 4x4',
    shortCode: '4x4x7',
    dimensions: { length: 4.0, width: 4.0, height: 7.0, unit: 'ft' },
    dimensionsInches: '48" × 48" × 84"',
    mylarRating: '1680D Thread Count Diamond Mylar',
    poleDiameter: 'Solid Steel Interlocking Pins',
    ventPorts: 'EZ-View 10" Double Cinching Ports',
    weightCapacityLbs: 300,
    description: 'Extra tall 7-foot ceiling with industrial-grade zipper wraps and 360-degree access.',
    recommendedUse: 'Tall Sativas & Extended Vertical Growth',
    iconColor: 'text-emerald-400'
  }
];
