import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../src/game';
import { expNeeded } from '../src/rules';

describe('Game Engine State Machine & Combat', () => {
  let g: Game;

  beforeEach(() => {
    g = new Game();
  });

  it('initializes Wizard with Fireball and base stats', () => {
    g.start('wizard', 'bichon', 'trial', 176);
    expect(g.phase).toBe('battle');
    expect(g.heroClass).toBe('wizard');
    expect(g.chapter).toBe('bichon');
    expect(g.player.hp).toBe(100);
    expect(g.maxHP).toBe(100);
    expect(g.skills.length).toBe(1);
    expect(g.skills[0].id).toBe('fireball');
    expect(g.level).toBe(1);
    expect(g.gold).toBe(0);
    expect(g.kills).toBe(0);
  });

  it('initializes Taoist with Soul Fireball and supports Minion Summoning', () => {
    g.start('taoist', 'mine', 'trial', 176);
    expect(g.heroClass).toBe('taoist');
    expect(g.chapter).toBe('mine');
    expect(g.player.hp).toBe(135);
    expect(g.skills[0].id).toBe('soul_fireball');

    // Add summon skeleton skill and cast
    const skelSkill = g.newSkill('summon_skeleton');
    g.skills.push(skelSkill);
    g.cast(skelSkill);

    expect(g.minions.length).toBe(1);
    expect(g.minions[0].kind).toBe('skeleton');
    expect(g.minions[0].hp).toBeGreaterThan(0);

    // Add heal skill and cast
    g.player.hp = 50;
    const healSkill = g.newSkill('heal_self');
    g.skills.push(healSkill);
    g.cast(healSkill);
    expect(g.player.hp).toBeGreaterThan(50);
  });

  it('initializes Warrior with Half Moon and high HP/Defense', () => {
    g.start('warrior', 'temple', 'trial', 176);
    expect(g.heroClass).toBe('warrior');
    expect(g.chapter).toBe('temple');
    expect(g.player.hp).toBe(185);
    expect(g.stats.def_flat).toBeGreaterThanOrEqual(5);
    expect(g.skills[0].id).toBe('half_moon');

    // Cast half moon
    const halfMoon = g.skills[0];
    g.cast(halfMoon);
    expect(halfMoon.cd).toBeGreaterThan(0);
  });

  it('updates player movement and respects boundary clamping', () => {
    g.start('wizard', 'bichon', 'trial', 176);
    const initialX = g.player.x;

    // Move Right (x: 1, y: 0)
    g.input = { x: 1, y: 0 };
    g.step(0.1);
    expect(g.player.x).toBeGreaterThan(initialX);
    expect(g.player.moving).toBe(true);

    // Extreme movement cannot escape bounds
    g.input = { x: -9999, y: -9999 };
    for (let i = 0; i < 50; i++) g.step(0.1);
    expect(g.player.x).toBeGreaterThanOrEqual(30);
    expect(g.player.y).toBeGreaterThanOrEqual(45);
  });

  it('triggers level up and offers 3 balanced choices', () => {
    g.start('wizard', 'bichon', 'trial', 176);
    const needed = expNeeded(1);
    g.exp = needed;
    g.step(0.01);

    expect(g.phase).toBe('upgrade');
    expect(g.level).toBe(2);
    expect(g.choices.length).toBe(3);

    // Ensure choices contain unique options
    const ids = g.choices.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);

    // Choose the first upgrade
    const chosen = g.choices[0];
    g.choose(chosen.id);

    // Resumes to battle
    expect(g.phase).toBe('battle');
    expect(g.choices.length).toBe(0);
  });

  it('wave end reclaims 100% leftover exp and 50% leftover gold', () => {
    g.start('wizard', 'bichon', 'trial', 176);
    g.drops = [
      { id: 1, x: 100, y: 100, exp: 10, gold: 20, born: 0 },
      { id: 2, x: 200, y: 200, exp: 5, gold: 10, born: 0 },
    ];

    g.endWave();

    // Exp received: 10 + 5 = 15
    expect(g.exp).toBe(15);
    // Gold received: floor((20 + 10) * 0.5) = 15
    expect(g.gold).toBe(15);
    expect(g.drops.length).toBe(0);
    expect(g.phase).toBe('shop');
  });

  it('shop handles purchases, locking, and prevents negative gold', () => {
    g.start('wizard', 'bichon', 'trial', 176);
    g.gold = 100;
    g.endWave();

    expect(g.offers.length).toBe(4);
    const affordable = g.offers.find((o) => o.price <= g.gold)!;
    expect(affordable).toBeDefined();

    const price = affordable.price;
    const bought = g.buy(affordable.id);
    expect(bought).toBe(true);
    expect(g.gold).toBe(100 - price);
    expect(affordable.sold).toBe(true);

    // Cannot buy already sold item
    expect(g.buy(affordable.id)).toBe(false);

    // Cannot buy item when gold is insufficient
    g.gold = 0;
    const unsold = g.offers.find((o) => !o.sold);
    if (unsold) {
      expect(g.buy(unsold.id)).toBe(false);
    }
  });

  it('special item: Revive Ring prevents death once', () => {
    g.start('warrior', 'bichon', 'trial', 176);
    g.equipment.ringR = { itemId: 'ring-revive', paid: 1600 };
    g.player.hp = 10;

    // Fatal damage (100)
    g.hurt(100);

    // Should be revived with 50% HP!
    expect(g.revived).toBe(true);
    expect(g.player.hp).toBeGreaterThan(0);
    expect(g.phase).toBe('battle');

    // Second fatal damage kills
    g.player.hitUntil = 0;
    g.hurt(500);
    expect(g.phase).toBe('dead');
  });

  it('records telemetry and finishes on boss defeat with crystals', () => {
    g.start('wizard', 'bichon', 'trial', 176);
    g.damageDealt = { fireball: 450, lightning: 820 };
    g.kills = 35;
    g.gold = 120;
    g.bossKilled = true;

    g.finish(true);

    expect(g.phase).toBe('won');
    expect(g.result).toBeDefined();
    expect(g.result?.won).toBe(true);
    expect(g.result?.crystals).toBeGreaterThan(0);
    expect(g.result?.kills).toBe(35);
    expect(g.result?.skillDamage.fireball).toBe(450);
  });
});
