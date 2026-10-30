import { describe, it, expect } from 'vitest';
import { expNeeded } from '../src/rules';
import { Game } from '../src/game';
import { WAVE_BUDGET, MONSTERS } from '../src/content';

describe('Difficulty & Experience Pacing System', () => {
  it('expNeeded scales progressively to prevent early level spam', () => {
    // Level 1: requires 46 exp (~15-20 early monsters)
    expect(expNeeded(1)).toBe(46);
    // Level 2: requires 75 exp
    expect(expNeeded(2)).toBe(75);
    // Level 3: requires 111 exp
    expect(expNeeded(3)).toBe(111);
    // Level 5: requires 203 exp
    expect(expNeeded(5)).toBe(203);
    // Level 10: requires 539 exp
    expect(expNeeded(10)).toBe(539);
    // Level 20: requires 1621 exp
    expect(expNeeded(20)).toBe(1621);
  });

  it('guarantees Wave 1 only yields 1 level-up from regular monster kills', () => {
    const g = new Game();
    g.start('wizard', 'bichon', 'normal', 176);

    // Wave 1 monster budget is 35
    expect(WAVE_BUDGET[0]).toBe(35);

    // Scarecrow exp is 2, Cat exp is 2
    const scarecrow = MONSTERS.find((m) => m.id === 'scarecrow')!;
    expect(scarecrow.exp).toBe(2);

    // Killing 15 scarecrows yields 30 exp (< 46 exp needed for Lv.2)
    for (let i = 0; i < 15; i++) {
      g.exp += scarecrow.exp;
    }
    expect(g.exp).toBe(30);
    expect(g.level).toBe(1);

    // Killing 8 more scarecrows (total 23 kills, 46 exp) triggers first level up
    for (let i = 0; i < 8; i++) {
      g.exp += scarecrow.exp;
    }
    expect(g.exp).toBe(46);
    if (g.exp >= expNeeded(g.level)) {
      g.beginUpgrade();
    }
    expect(g.level).toBe(2);
    expect(g.exp).toBe(0);

    // Remaining 12 monsters in Wave 1 grant 24 exp
    for (let i = 0; i < 12; i++) {
      g.exp += scarecrow.exp;
    }
    // Player finishes Wave 1 at Level 2 with 24 / 75 exp (cannot reach Lv.3 in wave 1)
    expect(g.level).toBe(2);
    expect(g.exp).toBe(24);
    expect(g.exp < expNeeded(g.level)).toBe(true);
  });

  it('paces skill evolution so it cannot be acquired prematurely in wave 1', () => {
    const g = new Game();
    g.start('warrior', 'bichon', 'normal', 176);

    const starterSkill = g.skills[0];
    expect(starterSkill.rank).toBe(1);
    expect(starterSkill.evolved).toBeUndefined();

    // In Wave 1, player only reaches Lv.2
    g.exp = expNeeded(1);
    g.beginUpgrade();
    expect(g.level).toBe(2);

    // Evolution choice should NOT be present because rank is 1 (< 3)
    let evoChoice = g.choices.find((c) => c.isEvolution);
    expect(evoChoice).toBeUndefined();

    // Player selects rank 2 enhancement
    const enhChoice = g.choices.find((c) => c.kind === 'skill' && c.skill === starterSkill.id);
    if (enhChoice) {
      g.choose(enhChoice.id);
      expect(starterSkill.rank).toBe(2);
    }

    // Even at rank 2, evolution is still not offered
    g.exp = expNeeded(2);
    g.beginUpgrade();
    expect(g.level).toBe(3);
    evoChoice = g.choices.find((c) => c.isEvolution);
    expect(evoChoice).toBeUndefined();
  });

  it('guarantees monster HP and damage scale gracefully from wave 1 to wave 12', () => {
    const g = new Game();
    g.start('wizard', 'bichon', 'normal', 176);

    // Wave 1
    g.wave = 1;
    g.spawned = 0;
    g.enemies = [];
    g.spawnEnemy('scarecrow');
    const wave1Mob = g.enemies[0];
    expect(wave1Mob.hp).toBe(18); // Base 18 * 1.0
    expect(wave1Mob.damage).toBe(1);

    // Wave 4 (first elites appear)
    g.wave = 4;
    g.spawned = Math.floor(WAVE_BUDGET[3] / 2); // middle of wave budget triggers elite
    g.enemies = [];
    g.spawnEnemy('orc');
    const wave4Elite = g.enemies[0];
    expect(wave4Elite.elite).toBe(true);
    // Base 42 * 3.5 elite * ~2.44 waveHpMult = ~359 HP
    expect(wave4Elite.hp).toBeGreaterThan(300);
    expect(wave4Elite.damage).toBeGreaterThan(wave1Mob.damage);

    // Wave 12 (Boss wave)
    g.wave = 12;
    g.spawned = 0;
    g.enemies = [];
    g.spawnEnemy('boss_bichon');
    const bossMob = g.enemies[0];
    // Base 950 * ~8.70 waveHpMult = ~8265 HP
    expect(bossMob.hp).toBeGreaterThan(7000);
    expect(bossMob.damage).toBeGreaterThan(50);
  });
});
