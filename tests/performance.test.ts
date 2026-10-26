import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../src/game';
import { SpatialHash } from '../src/rules';
import type { Enemy } from '../src/types';

describe('Performance & Stress Test (300+ Monsters & Drops)', () => {
  let g: Game;

  beforeEach(() => {
    g = new Game();
  });

  it('spatial hash query with 350 monsters executes in < 2ms', () => {
    const hash = new SpatialHash<Enemy>(70);
    const enemies: Enemy[] = [];

    for (let i = 0; i < 350; i++) {
      const e: Enemy = {
        id: i + 1,
        kind: 'skeleton',
        name: '骷髅',
        x: (i % 20) * 80 + 100,
        y: Math.floor(i / 20) * 70 + 100,
        hp: 50,
        maxHp: 50,
        speed: 40,
        damage: 6,
        exp: 6,
        dir: 4,
        windup: 0,
        attackCD: 0,
        shootCD: 0,
        hitAt: -1,
        burnAt: 0,
        elite: false,
        born: 0,
        aiType: 'melee',
        status: { poisonedUntil: 0, poisonDamage: 0, poisonDefDown: 0, paralyzedUntil: 0 },
      };
      enemies.push(e);
    }
    hash.rebuild(enemies);

    const t0 = performance.now();
    for (let q = 0; q < 50; q++) {
      const nearby = hash.nearby(500, 500, 150);
      expect(nearby).toBeDefined();
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(10); // 50 spatial queries in < 10ms
  });

  it('enforces drop merging when drop count reaches 300', () => {
    g.start('wizard', 'bichon', 'trial', 176);

    // Fill drops up to 300
    for (let i = 0; i < 300; i++) {
      g.drops.push({
        id: i + 1,
        x: 100 + (i % 20) * 10,
        y: 100 + Math.floor(i / 20) * 10,
        exp: 2,
        gold: 2,
        born: 0,
      });
    }
    expect(g.drops.length).toBe(300);

    const initialExp0 = g.drops[0].exp;
    const initialGold0 = g.drops[0].gold;

    // Kill 10 normal enemies
    for (let i = 0; i < 10; i++) {
      const e: Enemy = {
        id: 1000 + i,
        kind: 'scarecrow',
        name: '稻草人',
        x: 800,
        y: 800,
        hp: 1,
        maxHp: 18,
        speed: 30,
        damage: 2,
        exp: 4,
        dir: 4,
        windup: 0,
        attackCD: 0,
        shootCD: 0,
        hitAt: -1,
        burnAt: 0,
        elite: false,
        born: 0,
        aiType: 'melee',
        status: { poisonedUntil: 0, poisonDamage: 0, poisonDefDown: 0, paralyzedUntil: 0 },
      };
      g.hit(e, 10, 'fireball');
    }

    // Drops array length should remain exactly 300 (or capped without unbounded memory growth)
    expect(g.drops.length).toBe(300);
    // Merged into drops[0]
    expect(g.drops[0].exp).toBeGreaterThan(initialExp0);
  });

  it('runs 60 update ticks with 300 active enemies well under 16.7ms frame budget', () => {
    g.start('warrior', 'temple', 'normal', 176);

    // Spawn 300 active enemies
    for (let i = 0; i < 300; i++) {
      const angle = (i / 300) * Math.PI * 2;
      const dist = 100 + (i % 15) * 20;
      g.enemies.push({
        id: 2000 + i,
        kind: 'orc',
        name: '半兽人',
        x: g.player.x + Math.cos(angle) * dist,
        y: g.player.y + Math.sin(angle) * dist,
        hp: 40,
        maxHp: 40,
        speed: 38,
        damage: 5,
        exp: 4,
        dir: 4,
        windup: 0,
        attackCD: 0,
        shootCD: 0,
        hitAt: -1,
        burnAt: 0,
        elite: false,
        born: 0,
        aiType: 'melee',
        status: { poisonedUntil: 0, poisonDamage: 0, poisonDefDown: 0, paralyzedUntil: 0 },
      });
    }

    const t0 = performance.now();
    for (let frame = 0; frame < 60; frame++) {
      g.step(0.016); // 16ms per frame
    }
    const totalElapsed = performance.now() - t0;
    const avgPerTick = totalElapsed / 60;

    // Each tick must take < 16.7ms (60 FPS threshold)
    expect(avgPerTick).toBeLessThan(16.7);
  });
});
