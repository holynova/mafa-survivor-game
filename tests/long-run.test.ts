import { it, expect, describe } from 'vitest';
import { Game, WORLD } from '../src/game';
import { getItem } from '../src/content';
import type { HeroClass } from '../src/types';

function simulateRun(heroClass: HeroClass, mode: 'trial' | 'normal', seed = 176) {
  const g = new Game();
  g.start(heroClass, 'bichon', mode, seed);

  let shops = 0;
  let upgrades = 0;
  const maxSteps = mode === 'trial' ? 60 * 130 : 60 * 950;

  for (let step = 0; step < maxSteps; step++) {
    if (g.phase === 'upgrade') {
      g.choose(g.choices[0].id);
      upgrades++;
      continue;
    }
    if (g.phase === 'shop') {
      shops++;
      // Auto-buy any available items if affordable
      for (const o of g.offers) {
        if (!o.sold && g.gold >= o.price) {
          g.buy(o.id);
        }
      }
      g.nextWave();
      continue;
    }
    if (g.phase === 'won' || g.phase === 'dead') break;

    // Nearest drop or monster
    const target = g.drops.reduce<(typeof g.drops)[number] | null>(
      (best, d) =>
        !best ||
        Math.hypot(d.x - g.player.x, d.y - g.player.y) <
          Math.hypot(best.x - g.player.x, best.y - g.player.y)
          ? d
          : best,
      null
    );

    const destX = target ? target.x : WORLD.w / 2 + Math.cos(g.clock * 0.1) * 200;
    const destY = target ? target.y : WORLD.h / 2 + Math.sin(g.clock * 0.1) * 200;
    const dx = destX - g.player.x;
    const dy = destY - g.player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));

    g.input = {
      x: dx / dist,
      y: dy / dist,
    };

    g.step(1 / 60);

    expect(g.gold).toBeGreaterThanOrEqual(0);
    expect(g.enemies.length).toBeLessThanOrEqual(350);
    expect(g.drops.length).toBeLessThanOrEqual(350);
    expect(g.skills.length).toBeLessThanOrEqual(6);
  }

  return {
    phase: g.phase,
    clock: g.clock,
    wave: g.wave,
    kills: g.kills,
    level: g.level,
    shops,
    upgrades,
    won: g.phase === 'won',
    result: g.result,
  };
}

describe('End-to-End Simulation of Expeditions', () => {
  it('simulates a complete Trial run with Wizard to victory or defeat without errors', () => {
    const res = simulateRun('wizard', 'trial', 176);
    expect(['won', 'dead']).toContain(res.phase);
    expect(res.shops).toBeGreaterThanOrEqual(1);
    expect(res.level).toBeGreaterThanOrEqual(2);
    expect(res.result).toBeDefined();
  });

  it('simulates a complete Trial run with Taoist supporting minions', () => {
    const res = simulateRun('taoist', 'trial', 176);
    expect(['won', 'dead']).toContain(res.phase);
    expect(res.shops).toBeGreaterThanOrEqual(1);
    expect(res.result).toBeDefined();
  });

  it('simulates a complete Trial run with Warrior with high resilience', () => {
    const res = simulateRun('warrior', 'trial', 176);
    expect(['won', 'dead']).toContain(res.phase);
    expect(res.shops).toBeGreaterThanOrEqual(1);
    expect(res.result).toBeDefined();
  });

  it('maintains deterministic replayability given the exact same seed', () => {
    const run1 = simulateRun('wizard', 'trial', 999);
    const run2 = simulateRun('wizard', 'trial', 999);

    expect(run1.phase).toBe(run2.phase);
    expect(run1.wave).toBe(run2.wave);
    expect(run1.kills).toBe(run2.kills);
    expect(run1.level).toBe(run2.level);
    expect(run1.shops).toBe(run2.shops);
  });
});
