import type { Bonuses, StatKey } from './types';

/**
 * Deterministic pseudo-random number generator using Mulberry32 algorithm.
 * Ensures identical results given identical seed and input sequences.
 */
export class Rng {
  constructor(public seed: number) {}

  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  pick<T>(arr: readonly T[] | T[]): T {
    if (!arr.length) throw new Error('Cannot pick from empty pool');
    return arr[this.int(arr.length)];
  }

  shuffle<T>(arr: readonly T[] | T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

export const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

/**
 * Soft cap with half-diminishing returns between soft and hard caps.
 */
export function softCap(raw: number, soft: number, hard: number): number {
  if (raw <= soft) return raw;
  return Math.min(hard, soft + (raw - soft) * 0.5);
}

/**
 * Applies soft and hard caps according to GDD Section 2.4 rules.
 */
export function effective(key: StatKey, raw: number): number {
  switch (key) {
    case 'move_speed':
      return softCap(raw, 20, 35);
    case 'pickup_radius':
      return softCap(raw, 80, 150);
    case 'cooldown_reduction':
      return softCap(raw, 20, 40);
    case 'skill_radius':
      return softCap(raw, 20, 35);
    case 'hp_regen':
      return softCap(raw, 4, 8);
    case 'duration':
      return Math.min(75, raw);
    case 'gold_gain':
      return Math.min(40, raw);
    case 'exp_gain':
      return Math.min(50, raw);
    case 'crit_chance':
      return Math.min(50, raw);
    case 'crit_mult':
      return Math.min(0.75, raw);
    case 'dodge':
      return Math.min(30, raw);
    case 'projectile_speed':
      return Math.min(100, raw);
    default:
      return raw;
  }
}

/**
 * Combines multiple stat bonuses and applies effective caps.
 */
export function combine(sources: Bonuses[]): Bonuses {
  const merged: Bonuses = {};
  for (const s of sources) {
    for (const [k, v] of Object.entries(s)) {
      const key = k as StatKey;
      merged[key] = (merged[key] ?? 0) + (v ?? 0);
    }
  }
  for (const k of Object.keys(merged) as StatKey[]) {
    merged[k] = effective(k, merged[k] ?? 0);
  }
  return merged;
}

/**
 * Incoming damage calculation with defense and shield mitigation.
 * Hard damage reduction cap: 65%. Minimum damage taken: 1.
 */
export function incomingDamage(raw: number, defense: number, shield: number): number {
  const defReduction = defense / (defense + 22);
  const totalReduction = Math.min(0.65, 1 - (1 - defReduction) * (1 - shield));
  return Math.max(1, Math.ceil(raw * (1 - totalReduction)));
}

/**
 * Reroll price in wave shop: 20 + 15*n + 5*n^2
 */
export const rerollPrice = (n: number): number => 20 + 15 * n + 5 * n * n;

/**
 * Sell price formula: 50% of paid price (if bought), or 30% of base price.
 */
export const sellPrice = (paid: number, base: number): number =>
  Math.max(0, Math.floor(paid > 0 ? Math.min(paid * 0.5, base * 0.5) : base * 0.3));

/**
 * Experience needed for next level: 12 + 8 * level
 */
export const expNeeded = (level: number): number => 12 + 8 * level;

/**
 * Spatial partition grid for high-performance entity proximity queries.
 */
export class SpatialHash<T extends { id: number; x: number; y: number }> {
  private cells = new Map<string, T[]>();

  constructor(private size = 80) {}

  rebuild(entities: T[]) {
    this.cells.clear();
    for (const e of entities) {
      const key = this.key(e.x, e.y);
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = [];
        this.cells.set(key, bucket);
      }
      bucket.push(e);
    }
  }

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`;
  }

  nearby(x: number, y: number, r: number): T[] {
    const out: T[] = [];
    const minX = Math.floor((x - r) / this.size);
    const maxX = Math.floor((x + r) / this.size);
    const minY = Math.floor((y - r) / this.size);
    const maxY = Math.floor((y + r) / this.size);
    const rSq = r * r;

    for (let ix = minX; ix <= maxX; ix++) {
      for (let iy = minY; iy <= maxY; iy++) {
        const bucket = this.cells.get(`${ix},${iy}`);
        if (!bucket) continue;
        for (const e of bucket) {
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= rSq) {
            out.push(e);
          }
        }
      }
    }
    return out;
  }
}
