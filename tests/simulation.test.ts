import { describe, it, expect } from 'vitest';
import { Game } from '../src/game';
import type { HeroClass, MapChapter } from '../src/types';

describe('P4-01: Large-Scale Simulation & Balance Verification', () => {
  const classes: HeroClass[] = ['wizard', 'taoist', 'warrior'];
  const chapters: MapChapter[] = ['bichon', 'mine', 'temple'];

  it('runs 1,000 randomized seed initializations with zero crashes or out-of-bounds states', () => {
    for (let i = 0; i < 1000; i++) {
      const g = new Game();
      const heroClass = classes[i % 3];
      const chapter = chapters[Math.floor(i / 3) % 3];
      const seed = 1000 + i;

      g.start(heroClass, chapter, 'trial', seed);

      expect(g.player.x).toBeGreaterThan(0);
      expect(g.player.y).toBeGreaterThan(0);
      expect(isNaN(g.player.hp)).toBe(false);
      expect(g.player.hp).toBeGreaterThan(0);
      expect(g.skills.length).toBeGreaterThanOrEqual(1);
      expect(g.phase).toBe('battle');
    }
  });

  it('simulates 100 fast-paced combat runs per class to verify zero NaNs and valid economy bounds', () => {
    const stats: Record<HeroClass, { runs: number; won: number; totalGold: number; totalKills: number }> = {
      wizard: { runs: 0, won: 0, totalGold: 0, totalKills: 0 },
      taoist: { runs: 0, won: 0, totalGold: 0, totalKills: 0 },
      warrior: { runs: 0, won: 0, totalGold: 0, totalKills: 0 },
    };

    for (let i = 0; i < 300; i++) {
      const g = new Game();
      const heroClass = classes[i % 3];
      const seed = 5000 + i;
      g.start(heroClass, 'bichon', 'trial', seed);

      // Simulate 180 steps with movement toward drops/enemies
      for (let step = 0; step < 180; step++) {
        if (g.phase === 'upgrade') {
          // Auto choose first available upgrade
          if (g.choices.length > 0) {
            g.choose(g.choices[0].id);
          }
        } else if (g.phase === 'shop') {
          // Auto buy affordable items
          for (const o of g.offers) {
            if (o.price <= g.gold && !o.sold) {
              g.buy(o.id);
            }
          }
          g.nextWave();
        } else if (g.phase === 'battle') {
          // Move towards drops to pick up loot, or towards nearest enemy
          if (g.drops.length > 0) {
            const target = g.drops[0];
            const dx = target.x - g.player.x;
            const dy = target.y - g.player.y;
            const dist = Math.hypot(dx, dy) || 1;
            g.input = { x: dx / dist, y: dy / dist };
          } else if (g.enemies.length > 0) {
            const target = g.enemies[0];
            const dx = target.x - g.player.x;
            const dy = target.y - g.player.y;
            const dist = Math.hypot(dx, dy) || 1;
            g.input = { x: dx / dist, y: dy / dist };
          }
          g.step(0.1);
        } else {
          break;
        }
      }

      // Check invariants
      expect(isNaN(g.player.hp)).toBe(false);
      expect(isNaN(g.gold)).toBe(false);
      expect(g.gold).toBeGreaterThanOrEqual(0);
      expect(g.drops.length).toBeLessThanOrEqual(300);

      // Record class performance
      stats[heroClass].runs++;
      if (g.bossKilled || g.phase === 'won') stats[heroClass].won++;
      stats[heroClass].totalGold += g.totalGold;
      stats[heroClass].totalKills += g.kills;
    }

    // Verify all 3 classes are functional and participating in combat
    for (const c of classes) {
      expect(stats[c].runs).toBe(100);
      expect(stats[c].totalKills).toBeGreaterThan(0);
      expect(stats[c].totalGold).toBeGreaterThan(0);
    }
  });

  it('verifies deterministic execution given the same seed', () => {
    const seed = 888176;

    const g1 = new Game();
    g1.start('warrior', 'mine', 'trial', seed);
    for (let i = 0; i < 50; i++) g1.step(0.05);

    const g2 = new Game();
    g2.start('warrior', 'mine', 'trial', seed);
    for (let i = 0; i < 50; i++) g2.step(0.05);

    expect(g1.spawned).toBe(g2.spawned);
    expect(g1.enemies.length).toBe(g2.enemies.length);
    if (g1.enemies.length > 0 && g2.enemies.length > 0) {
      expect(g1.enemies[0].kind).toBe(g2.enemies[0].kind);
      expect(g1.enemies[0].x).toBeCloseTo(g2.enemies[0].x, 1);
      expect(g1.enemies[0].y).toBeCloseTo(g2.enemies[0].y, 1);
    }
  });
});
