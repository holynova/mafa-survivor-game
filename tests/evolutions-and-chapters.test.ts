import { describe, it, expect, beforeEach } from 'vitest';
import { Game, SKILL_EVOLUTIONS } from '../src/game';
import { CHAPTERS } from '../src/content';
import { CHAPTER_UNLOCK_COSTS, unlockChapter, unlockAllChapters, getProfile, saveProfile } from '../src/save';
import type { MapChapter } from '../src/types';

describe('New Chapters: Cangyue & Moon', () => {
  it('defines valid chapter data for cangyue and moon', () => {
    expect(CHAPTERS.cangyue).toBeDefined();
    expect(CHAPTERS.cangyue.name).toContain('苍月');
    expect(CHAPTERS.cangyue.bossName).toBe('牛魔王');

    expect(CHAPTERS.moon).toBeDefined();
    expect(CHAPTERS.moon.name).toContain('赤月');
    expect(CHAPTERS.moon.bossName).toBe('赤月恶魔');
  });

  it('has unlock costs for all 7 chapters in correct progression', () => {
    const chapters: MapChapter[] = ['bichon', 'mine', 'temple', 'tomb', 'desert', 'cangyue', 'moon'];
    for (const c of chapters) {
      expect(CHAPTER_UNLOCK_COSTS[c]).toBeDefined();
      expect(typeof CHAPTER_UNLOCK_COSTS[c]).toBe('number');
    }
    expect(CHAPTER_UNLOCK_COSTS.cangyue).toBe(60);
    expect(CHAPTER_UNLOCK_COSTS.moon).toBe(85);
  });

  it('supports unlocking all chapters including cangyue and moon', async () => {
    const p = await unlockAllChapters();
    expect(p.unlockedChapters).toContain('cangyue');
    expect(p.unlockedChapters).toContain('moon');
  });
});

describe('Skill Evolution System', () => {
  let g: Game;

  beforeEach(() => {
    g = new Game();
  });

  it('has evolution definitions for primary signature skills', () => {
    expect(SKILL_EVOLUTIONS.half_moon).toBeDefined();
    expect(SKILL_EVOLUTIONS.half_moon.name).toContain('半月弯刀');

    expect(SKILL_EVOLUTIONS.fire_swordplay).toBeDefined();
    expect(SKILL_EVOLUTIONS.fire_swordplay.name).toContain('双烈火');

    expect(SKILL_EVOLUTIONS.piercing_swordplay).toBeDefined();
    expect(SKILL_EVOLUTIONS.piercing_swordplay.name).toContain('逐日剑气');

    expect(SKILL_EVOLUTIONS.lightning).toBeDefined();
    expect(SKILL_EVOLUTIONS.lightning.name).toContain('九天');

    expect(SKILL_EVOLUTIONS.firewall).toBeDefined();
    expect(SKILL_EVOLUTIONS.firewall.name).toContain('灭世火海');

    expect(SKILL_EVOLUTIONS.ice_storm).toBeDefined();
    expect(SKILL_EVOLUTIONS.ice_storm.name).toContain('暴风雪');

    expect(SKILL_EVOLUTIONS.summon_shinsu).toBeDefined();
    expect(SKILL_EVOLUTIONS.summon_shinsu.name).toContain('至尊烈焰圣兽');

    expect(SKILL_EVOLUTIONS.summon_skeleton).toBeDefined();
    expect(SKILL_EVOLUTIONS.summon_skeleton.name).toContain('变异双骨');

    expect(SKILL_EVOLUTIONS.poison).toBeDefined();
    expect(SKILL_EVOLUTIONS.poison.name).toContain('蚀骨瘟疫');
  });

  it('offers evolution choice when skill reaches rank 3', () => {
    g.start('warrior', 'bichon', 'normal', 176);
    // Find half_moon skill and set rank 3
    let s = g.skills.find((sk) => sk.id === 'half_moon');
    if (!s) {
      g.skills.push({
        id: 'half_moon',
        rank: 3,
        cd: 0,
        power: 0,
        count: 0,
        radius: 0,
        duration: 0,
        localCDR: 0,
        shieldReduction: 0,
      });
      s = g.skills.find((sk) => sk.id === 'half_moon')!;
    } else {
      s.rank = 3;
    }

    const choices = g.makeChoices();
    const evoChoice = choices.find((c) => c.id === 'evo-half_moon');
    expect(evoChoice).toBeDefined();
    expect(evoChoice?.isEvolution).toBe(true);
    expect(evoChoice?.name).toContain('半月弯刀');
  });

  it('correctly applies evolution when chosen', () => {
    g.start('warrior', 'bichon', 'normal', 176);
    let s = g.skills.find((sk) => sk.id === 'half_moon');
    if (!s) {
      g.skills.push({
        id: 'half_moon',
        rank: 3,
        cd: 0,
        power: 0,
        count: 0,
        radius: 0,
        duration: 0,
        localCDR: 0,
        shieldReduction: 0,
      });
      s = g.skills.find((sk) => sk.id === 'half_moon')!;
    } else {
      s.rank = 3;
    }

    g.phase = 'upgrade';
    g.choices = [
      {
        id: 'evo-half_moon',
        kind: 'skill',
        skill: 'half_moon',
        isEvolution: true,
        name: SKILL_EVOLUTIONS.half_moon.name,
        description: SKILL_EVOLUTIONS.half_moon.description,
        value: 0,
      },
    ];

    const initialPower = s.power;
    g.choose('evo-half_moon');

    expect(s.evolved).toBe(true);
    expect(s.power).toBeGreaterThan(initialPower);
    expect(g.phase).toBe('battle');
  });

  it('evolved half-moon performs a 360-degree sweep hitting surrounding enemies', () => {
    g.start('warrior', 'bichon', 'normal', 176);
    let s = g.skills.find((sk) => sk.id === 'half_moon');
    if (!s) {
      g.skills.push({
        id: 'half_moon',
        rank: 3,
        cd: 0,
        power: 0,
        count: 0,
        radius: 0,
        duration: 0,
        localCDR: 0,
        shieldReduction: 0,
        evolved: true,
      });
      s = g.skills.find((sk) => sk.id === 'half_moon')!;
    } else {
      s.rank = 3;
      s.evolved = true;
    }

    // Place an enemy directly behind the warrior (180 degrees away)
    // Warrior facing dir 4 (East) -> enemy at West
    g.player.x = 500;
    g.player.y = 500;
    g.player.dir = 2; // North

    // Behind is South (500, 580)
    g.enemies = [
      {
        id: 999,
        kind: 'scarecrow',
        name: '稻草人',
        x: 500,
        y: 580,
        hp: 100,
        maxHp: 100,
        speed: 50,
        damage: 10,
        exp: 10,
        dir: 0,
        windup: 0,
        attackCD: 0,
        shootCD: 0,
        hitAt: 0,
        burnAt: 0,
        elite: false,
        born: 0,
        aiType: 'melee',
        status: {
          poisonedUntil: 0,
          poisonDamage: 0,
          poisonDefDown: 0,
          paralyzedUntil: 0,
        },
      },
    ];

    s.cd = 0;
    g.step(0.1);

    // Enemy behind should take damage because evolved half-moon is a 360 degree whirlwind!
    expect(g.enemies[0].hp).toBeLessThan(100);
  });
});
