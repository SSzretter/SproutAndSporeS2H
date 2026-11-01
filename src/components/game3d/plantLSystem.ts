import * as THREE from 'three';
import { PlantItem, PlantSpecies, PlantStage, PropagationType } from '../../types/sim';
import { seededRandom } from './coords';

/**
 * Plant skeletons from bracketed, stochastic L-systems. A skeleton is derived once per plant
 * (seeded by its id) at full maturity, in "internode units" with +Y up. Every symbol remembers
 * the derivation step that produced it, which becomes its birth on a 0–1 growth scale, so a
 * partial plant is just the skeleton filtered by growth: internodes extend, then their leaves
 * unfold, then the next node starts. `layoutPlant` turns that into true-scale feet by fitting
 * the visible part to heightInches × canopyWidthInches.
 *
 * Turtle symbols:
 *   F(len) main-axis internode    G(len) branch internode
 *   + - yaw, & ^ pitch, / \ roll (degrees)    [ ] push / pop
 *   L(size) leaf    C cotyledon    K flower/fruit site at a node
 *   A(n) main apex    B(n) branch apex (n = forks / internodes so far); left-over apexes become tip sites
 */

interface Sym {
  s: string;
  a: number;
  gen: number;
}

export interface SkelSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  birth: number;
  parent: number;
  main: boolean;
}

export interface SkelLeaf {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  seg: number;
  birth: number;
  size: number;
  cotyledon: boolean;
  rand: number;
}

export interface SkelSite {
  pos: THREE.Vector3;
  seg: number;
  birth: number;
  tip: boolean;
  main: boolean;
  rand: number;
}

export interface PlantSkeleton {
  species: PlantSpecies;
  segments: SkelSegment[];
  leaves: SkelLeaf[];
  sites: SkelSite[];
  /** Growth needed for one derivation step (an internode extending, its leaves unfolding). */
  stepGrowth: number;
  /** Leaf length in internode units at size 1. */
  leafLength: number;
}

type Rand = () => number;

interface Grammar {
  iterations: number;
  leafLength: number;
  /** Per-internode bend toward +Y (negative droops), for branch and main-axis internodes. */
  tropism: number;
  mainTropism: number;
  rules: Record<string, (sym: Sym, step: number, rand: Rand) => Sym[] | null>;
}

// Share of the growth scale the skeleton develops over; the rest is fruit/flower filling out
const GROW_SPAN = 0.9;

const S = (s: string, a = 0): Sym => ({ s, a, gen: 0 });
const branch = (...syms: Sym[]): Sym[] => [S('['), ...syms, S(']')];
/** Opposite leaf pair at the current node. */
const leafPair = (size: number, pitch: number): Sym[] => [
  ...branch(S('&', pitch), S('L', size)),
  ...branch(S('/', 180), S('&', pitch), S('L', size))
];
const jitter = (rand: Rand, deg: number) => (rand() - 0.5) * deg;
// First true leaves are small; they reach full size a few nodes up
const leafSizeAt = (k: number, start: number, perNode: number) => Math.min(1, start + k * perNode);

const GRAMMARS: Record<PlantSpecies, Grammar> = {
  // Decussate fan-leaf pairs, a branch pair at each node whose length follows its age (the
  // Christmas-tree shape), and bud sites up the top once it stretches into flower.
  Cannabis: {
    iterations: 14,
    leafLength: 2.1,
    tropism: 0.22,
    mainTropism: 0,
    rules: {
      A: (sym, k, rand) => {
        const top = k > 10;
        const out = [S('F', top ? 0.8 : 1), ...leafPair(leafSizeAt(k, 0.35, 0.13), 52 + jitter(rand, 10))];
        if (k >= 2 && !top) {
          out.push(...branch(S('/', 45), S('&', 42), S('B', 0)), ...branch(S('/', 225), S('&', 42), S('B', 0)));
        }
        if (k >= 8) out.push(S('K'));
        return [...out, S('/', 90 + jitter(rand, 14)), S('A', sym.a)];
      },
      B: (sym, _, rand) => {
        if (sym.a >= 6 || rand() > 0.85) return null;
        return [S('G', 0.7), ...leafPair(0.72, 48), S('K'), S('/', 90), S('B', sym.a + 1)];
      }
    }
  },
  // Indeterminate vine: alternate compound leaves on a 137.5° spiral, a fruit truss every few
  // nodes, and the odd sucker left to grow.
  Tomato: {
    iterations: 13,
    leafLength: 1.9,
    tropism: 0.12,
    mainTropism: 0,
    rules: {
      A: (sym, k, rand) => {
        const out = [S('F', 1), ...branch(S('&', 62 + jitter(rand, 12)), S('L', leafSizeAt(k, 0.4, 0.12)))];
        if (k >= 5 && k % 3 === 2) out.push(...branch(S('/', 180), S('&', 70), S('K')));
        if (k >= 2 && k <= 9 && rand() < 0.4) out.push(...branch(S('/', 70), S('&', 38), S('B', 0)));
        return [...out, S('/', 137.5), S('A', sym.a)];
      },
      B: (sym, _, rand) => {
        if (sym.a >= 5 || rand() > 0.8) return null;
        const out = [S('G', 0.8), ...branch(S('&', 62), S('L', 0.85))];
        if (sym.a === 2) out.push(...branch(S('/', 180), S('&', 70), S('K')));
        return [...out, S('/', 137.5), S('B', sym.a + 1)];
      }
    }
  },
  // A short main stem, then repeated two-way forks into a rounded bush, pods hanging at the forks.
  'Chili Pepper': {
    iterations: 11,
    leafLength: 1.3,
    tropism: 0.1,
    mainTropism: 0.14,
    rules: {
      A: (sym, k, rand) => {
        const leaf = branch(S('&', 58 + jitter(rand, 12)), S('L', leafSizeAt(k, 0.45, 0.12)));
        if (k < 3) return [S('F', 1), ...leaf, S('/', 137.5), S('A', sym.a)];
        if (sym.a < 4 && (k - 3) % 2 === 0) {
          return [
            S('F', 0.8), ...leaf, S('K'),
            ...branch(S('/', 90), S('+', 26 + jitter(rand, 8)), S('A', sym.a + 1)),
            ...branch(S('/', 90), S('-', 26 + jitter(rand, 8)), S('A', sym.a + 1))
          ];
        }
        const out = [S('F', 0.7), ...leaf];
        if (rand() < 0.35) out.push(S('K'));
        return [...out, S('/', 137.5), S('A', sym.a)];
      }
    }
  },
  // Decussate, pinched-bushy: a branch pair at most nodes, flower spikes on every tip.
  Basil: {
    iterations: 10,
    leafLength: 1.15,
    tropism: 0.25,
    mainTropism: 0,
    rules: {
      A: (sym, k, rand) => {
        const out = [S('F', 0.8), ...leafPair(leafSizeAt(k, 0.45, 0.14), 50 + jitter(rand, 10))];
        if (k >= 2 && k <= 7) {
          out.push(...branch(S('/', 90), S('&', 40), S('B', 0)), ...branch(S('/', 270), S('&', 40), S('B', 0)));
        }
        return [...out, S('/', 90 + jitter(rand, 10)), S('A', sym.a)];
      },
      B: (sym, _, rand) => {
        if (sym.a >= 4 || rand() > 0.85) return null;
        return [S('G', 0.6), ...leafPair(0.8, 50), S('/', 90), S('B', sym.a + 1)];
      }
    }
  },
  // Bine climbing straight up its twine with opposite lobed leaves and short cone-bearing side arms.
  Hops: {
    iterations: 16,
    leafLength: 1.5,
    tropism: -0.08,
    mainTropism: 0,
    rules: {
      A: (sym, k, rand) => {
        const out = [S('F', 1), ...leafPair(leafSizeAt(k, 0.45, 0.1), 72 + jitter(rand, 10))];
        if (k >= 4) out.push(...branch(S('/', 90), S('&', 68), S('B', 0)));
        return [...out, S('/', 90 + jitter(rand, 20)), S('A', sym.a)];
      },
      B: (sym, _, rand) => {
        if (sym.a >= 3 || rand() > 0.8) return null;
        return [S('G', 0.55), ...branch(S('&', 60), S('L', 0.7)), S('K'), S('/', 180), S('B', sym.a + 1)];
      }
    }
  }
};

function derive(grammar: Grammar, axiom: Sym[], rand: Rand): Sym[] {
  let str = axiom;
  for (let step = 1; step <= grammar.iterations; step++) {
    const next: Sym[] = [];
    for (const sym of str) {
      const rule = grammar.rules[sym.s];
      const produced = rule ? rule(sym, step, rand) : null;
      if (!produced) {
        next.push(sym);
        continue;
      }
      for (const p of produced) next.push({ ...p, gen: step });
    }
    str = next;
  }
  return str;
}

const UP = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;

interface Turtle {
  pos: THREE.Vector3;
  H: THREE.Vector3;
  L: THREE.Vector3;
  U: THREE.Vector3;
  seg: number;
  birth: number;
  main: boolean;
}

const cloneTurtle = (t: Turtle): Turtle => ({ ...t, pos: t.pos.clone(), H: t.H.clone(), L: t.L.clone(), U: t.U.clone() });

function rotate(axis: THREE.Vector3, angle: number, ...vs: THREE.Vector3[]) {
  for (const v of vs) v.applyAxisAngle(axis, angle);
}

/** Bend the heading toward +Y in proportion to how far it is from vertical. */
function applyTropism(t: Turtle, e: number) {
  if (e === 0) return;
  const axis = new THREE.Vector3().crossVectors(t.H, UP);
  const s = axis.length();
  if (s < 1e-4) return;
  axis.divideScalar(s);
  rotate(axis, e * s, t.H, t.L, t.U);
}

export function buildPlantSkeleton(species: PlantSpecies, seed: string, propagation: PropagationType = 'seed'): PlantSkeleton {
  const grammar = GRAMMARS[species] || GRAMMARS.Cannabis;
  const rand = seededRandom(`${seed}:lsystem`);
  const stepGrowth = GROW_SPAN / (grammar.iterations + 1);

  // Seedlings start from a hypocotyl and cotyledons; cuttings from a bare stem
  const axiom = propagation === 'cutting'
    ? [S('F', 0.5), S('A', 0)]
    : [S('F', 0.35), ...branch(S('&', 80), S('C')), ...branch(S('/', 180), S('&', 80), S('C')), S('/', 90), S('A', 0)];
  const str = derive(grammar, axiom, rand);

  const segments: SkelSegment[] = [];
  const leaves: SkelLeaf[] = [];
  const sites: SkelSite[] = [];
  let t: Turtle = {
    pos: new THREE.Vector3(),
    H: new THREE.Vector3(0, 1, 0),
    L: new THREE.Vector3(-1, 0, 0),
    U: new THREE.Vector3(0, 0, 1),
    seg: -1,
    birth: 0,
    main: true
  };
  rotate(t.H, rand() * Math.PI * 2, t.L, t.U);
  const stack: Turtle[] = [];

  for (const sym of str) {
    switch (sym.s) {
      case 'F':
      case 'G': {
        const start = t.pos.clone();
        t.pos.addScaledVector(t.H, sym.a);
        t.main = sym.s === 'F';
        t.birth = sym.gen * stepGrowth;
        segments.push({ start, end: t.pos.clone(), birth: t.birth, parent: t.seg, main: t.main });
        t.seg = segments.length - 1;
        applyTropism(t, t.main ? grammar.mainTropism : grammar.tropism);
        break;
      }
      case '+': rotate(t.U, sym.a * DEG, t.H, t.L); break;
      case '-': rotate(t.U, -sym.a * DEG, t.H, t.L); break;
      case '&': rotate(t.L, sym.a * DEG, t.H, t.U); break;
      case '^': rotate(t.L, -sym.a * DEG, t.H, t.U); break;
      case '/': rotate(t.H, sym.a * DEG, t.L, t.U); break;
      case '\\': rotate(t.H, -sym.a * DEG, t.L, t.U); break;
      case '[': stack.push(cloneTurtle(t)); break;
      case ']': t = stack.pop() ?? t; break;
      case 'L':
      case 'C':
        leaves.push({
          pos: t.pos.clone(),
          dir: t.H.clone(),
          seg: t.seg,
          birth: t.birth + stepGrowth * (sym.s === 'C' ? 0.2 : 0.4),
          size: sym.s === 'C' ? 0.3 : sym.a,
          cotyledon: sym.s === 'C',
          rand: rand()
        });
        break;
      case 'K':
      case 'A':
      case 'B':
        sites.push({ pos: t.pos.clone(), seg: t.seg, birth: t.birth + stepGrowth, tip: sym.s !== 'K', main: t.main, rand: rand() });
        break;
    }
  }

  return { species, segments, leaves, sites, stepGrowth, leafLength: grammar.leafLength };
}

// Where each stage sits on the skeleton's growth scale; stageProgress interpolates within it.
// Germination and rooting are drawn as sprouts, not from the skeleton.
const STAGE_GROWTH: Record<PlantStage, [number, number]> = {
  germination: [0, 0],
  rooting: [0, 0],
  seedling: [0, 0.1],
  mature_seedling: [0.1, 0.25],
  vegetative: [0.25, 0.62],
  flowering: [0.62, 0.9],
  ripening: [0.9, 1],
  ready: [1, 1]
};

export function getPlantGrowth(plant: PlantItem): number {
  const [from, to] = STAGE_GROWTH[plant.stage] || [0, 0];
  const g = from + (to - from) * Math.max(0, Math.min(1, (plant.stageProgress || 0) / 100));
  // A rooted cutting already carries a few nodes
  return plant.propagationType === 'cutting' ? Math.max(g, 0.12) : g;
}

export interface LayoutStem {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  /** 0 = green and soft, 1 = woody base. */
  woody: number;
}

export interface LayoutLeaf {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  normal: THREE.Vector3;
  lengthFt: number;
  /** 0 → just emerged, 1 → fully unfolded. */
  unfold: number;
  /** 0 = oldest leaf on the plant, 1 = newest. */
  age: number;
  cotyledon: boolean;
  rand: number;
}

export interface LayoutSite {
  pos: THREE.Vector3;
  /** Height as a share of the plant's height. */
  heightT: number;
  tip: boolean;
  main: boolean;
  rand: number;
}

export interface PlantLayout {
  stems: LayoutStem[];
  leaves: LayoutLeaf[];
  sites: LayoutSite[];
}

export interface LayoutOptions {
  growth: number;
  heightFt: number;
  canopyRadiusFt: number;
  /** Largest real leaf for the species, in feet. */
  maxLeafFt: number;
  /** Extra downward tilt of every leaf (wilting), in degrees. */
  droopDeg: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The skeleton at `growth`, stretched to the plant's true height and canopy (feet, origin at the soil). */
export function layoutPlant(skel: PlantSkeleton, opts: LayoutOptions): PlantLayout {
  const { growth, heightFt, canopyRadiusFt, maxLeafFt, droopDeg } = opts;
  const step = skel.stepGrowth;

  // 1. What has emerged, in skeleton units
  const segFrac = skel.segments.map(s => clamp01((growth - s.birth) / step));
  const segEnd = skel.segments.map((s, i) => s.start.clone().lerp(s.end, segFrac[i]));
  const leafFrac = skel.leaves.map(l => (l.cotyledon && growth > 0.4 ? 0 : clamp01((growth - l.birth) / (step * 1.5))));

  let maxY = 1e-3;
  let maxR = 1e-3;
  const grow = (v: THREE.Vector3) => {
    maxY = Math.max(maxY, v.y);
    maxR = Math.max(maxR, Math.hypot(v.x, v.z));
  };
  segEnd.forEach((e, i) => segFrac[i] > 0 && grow(e));
  const tip = new THREE.Vector3();
  skel.leaves.forEach((l, i) => {
    if (leafFrac[i] <= 0) return;
    grow(tip.copy(l.pos).addScaledVector(l.dir, skel.leafLength * l.size * (0.3 + 0.7 * leafFrac[i])));
  });

  // 2. Fit to the plant's real size, without stretching the shape too far in either direction
  const sy = heightFt / maxY;
  const sxz = Math.max(sy * 0.4, Math.min(sy * 2.5, canopyRadiusFt / maxR));
  const toFeet = (v: THREE.Vector3) => new THREE.Vector3(v.x * sxz, v.y * sy, v.z * sxz);
  const leafScale = Math.sqrt(sy * sxz);

  // 3. Pipe model: a stem is as thick as the foliage it carries
  const carried = new Array(skel.segments.length).fill(0.5);
  skel.leaves.forEach((l, i) => { if (leafFrac[i] > 0 && l.seg >= 0) carried[l.seg] += 1; });
  for (let i = skel.segments.length - 1; i >= 0; i--) {
    const parent = skel.segments[i].parent;
    if (segFrac[i] > 0 && parent >= 0) carried[parent] += carried[i];
  }

  const stems: LayoutStem[] = [];
  skel.segments.forEach((s, i) => {
    if (segFrac[i] <= 0) return;
    stems.push({
      start: toFeet(s.start),
      end: toFeet(segEnd[i]),
      radius: Math.min(0.055, 0.004 + 0.0028 * Math.sqrt(carried[i])),
      woody: clamp01((carried[i] - 40) / 160)
    });
  });

  const droop = Math.tan(Math.min(70, droopDeg) * DEG);
  const leaves: LayoutLeaf[] = [];
  skel.leaves.forEach((l, i) => {
    const unfold = leafFrac[i];
    if (unfold <= 0) return;
    const seg = skel.segments[l.seg];
    const stemDir = seg ? toFeet(seg.end).sub(toFeet(seg.start)).normalize() : UP.clone();
    // Young leaves stand folded up against the stem and open outward as they unfold
    const dir = toFeet(l.dir).normalize().lerp(stemDir, (1 - unfold) * 0.7);
    dir.y -= droop * (0.5 + 0.5 * unfold);
    dir.normalize();
    const normal = UP.clone().addScaledVector(dir, -dir.y);
    if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0);
    normal.normalize().applyAxisAngle(dir, (l.rand - 0.5) * 0.6);
    leaves.push({
      pos: toFeet(l.pos),
      dir,
      normal,
      lengthFt: Math.min(maxLeafFt * l.size, skel.leafLength * l.size * leafScale) * (0.3 + 0.7 * unfold),
      unfold,
      age: growth > 0 ? clamp01(l.birth / growth) : 1,
      cotyledon: l.cotyledon,
      rand: l.rand
    });
  });

  const sites: LayoutSite[] = [];
  for (const s of skel.sites) {
    if (s.seg < 0 || segFrac[s.seg] < 1 || s.birth > growth + step) continue;
    const pos = toFeet(s.pos);
    sites.push({ pos, heightT: pos.y / heightFt, tip: s.tip, main: s.main, rand: s.rand });
  }

  return { stems, leaves, sites };
}
