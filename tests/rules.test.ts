import { describe, it, expect } from 'vitest';
import {
  Rng,
  softCap,
  effective,
  incomingDamage,
  rerollPrice,
  sellPrice,
  expNeeded,
  SpatialHash,
  combine,
} from '../src/rules';

describe('Rules & Formula Engine', () => {
  it('softCap correctly applies half-diminishing returns and hard cap', () => {
    // Under soft cap
    expect(softCap(10, 20, 40)).toBe(10);
    expect(softCap(20, 20, 40)).toBe(20);
    // Between soft and hard: soft + (raw - soft) * 0.5
    expect(softCap(30, 20, 40)).toBe(25);
    expect(softCap(60, 20, 40)).toBe(40);
    // Above hard cap
    expect(softCap(100, 20, 40)).toBe(40);
  });

  it('effective caps match GDD Section 2.4 definitions', () => {
    // move_speed: soft 20, hard 35
    expect(effective('move_speed', 15)).toBe(15);
    expect(effective('move_speed', 30)).toBe(25);
    expect(effective('move_speed', 100)).toBe(35);

    // cooldown_reduction: soft 20, hard 40
    expect(effective('cooldown_reduction', 20)).toBe(20);
    expect(effective('cooldown_reduction', 30)).toBe(25);
    expect(effective('cooldown_reduction', 90)).toBe(40);

    // pickup_radius: soft 80, hard 150
    expect(effective('pickup_radius', 80)).toBe(80);
    expect(effective('pickup_radius', 120)).toBe(100);
    expect(effective('pickup_radius', 300)).toBe(150);

    // crit_chance & dodge: hard caps
    expect(effective('crit_chance', 60)).toBe(50);
    expect(effective('dodge', 45)).toBe(30);
  });

  it('combine aggregates bonuses and enforces effective caps', () => {
    const combined = combine([
      { move_speed: 15, cooldown_reduction: 10 },
      { move_speed: 25, cooldown_reduction: 20 },
    ]);
    // move_speed raw = 40 -> softCap(40, 20, 35) = 20 + 10 = 30
    expect(combined.move_speed).toBe(30);
    // cdr raw = 30 -> softCap(30, 20, 40) = 20 + 5 = 25
    expect(combined.cooldown_reduction).toBe(25);
  });

  it('incomingDamage applies defense, shield mitigation and 65% max cap', () => {
    // raw 100, 0 def, 0 shield -> 100
    expect(incomingDamage(100, 0, 0)).toBe(100);

    // raw 100, def 22 -> defReduction = 22/(22+22) = 0.5 -> 50 dmg
    expect(incomingDamage(100, 22, 0)).toBe(50);

    // raw 100, def 22, shield 20% -> reduction = 1 - (1 - 0.5) * (1 - 0.2) = 0.6 -> 40 dmg
    expect(incomingDamage(100, 22, 0.2)).toBe(40);

    // Extreme defense: cannot exceed 65% max mitigation (min 35% damage taken)
    expect(incomingDamage(100, 9999, 0.9)).toBe(35);

    // Always minimum 1 damage
    expect(incomingDamage(1, 9999, 0.9)).toBe(1);
  });

  it('rerollPrice scales correctly: 20 + 15n + 5n^2', () => {
    expect(rerollPrice(0)).toBe(20);
    expect(rerollPrice(1)).toBe(40);
    expect(rerollPrice(2)).toBe(70);
    expect(rerollPrice(3)).toBe(110);
  });

  it('sellPrice adheres to 50% paid or 30% base', () => {
    expect(sellPrice(100, 80)).toBe(40); // paid > 0, min(50, 40) = 40
    expect(sellPrice(0, 100)).toBe(30);  // paid 0, 30% of base = 30
  });

  it('expNeeded scales: 12 + 8 * level', () => {
    expect(expNeeded(1)).toBe(20);
    expect(expNeeded(2)).toBe(28);
    expect(expNeeded(5)).toBe(52);
  });

  it('Rng produces deterministic sequences from seed', () => {
    const rng1 = new Rng(176);
    const rng2 = new Rng(176);
    const seq1 = [rng1.next(), rng1.next(), rng1.int(100)];
    const seq2 = [rng2.next(), rng2.next(), rng2.int(100)];
    expect(seq1).toEqual(seq2);
  });

  it('SpatialHash correctly queries nearby entities', () => {
    const hash = new SpatialHash<{ id: number; x: number; y: number }>(80);
    const entities = [
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 130, y: 120 },
      { id: 3, x: 500, y: 500 },
    ];
    hash.rebuild(entities);

    const near = hash.nearby(100, 100, 60);
    expect(near.map((e) => e.id)).toContain(1);
    expect(near.map((e) => e.id)).toContain(2);
    expect(near.map((e) => e.id)).not.toContain(3);
  });
});
