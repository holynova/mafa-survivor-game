import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../src/game';
import { expNeeded } from '../src/rules';

describe('Game Engine State Machine & Combat', () => {
  let g: Game;

  beforeEach(() => {
    g = new Game();
  });

  it('initializes Mage with Fireball and base stats', () => {
    g.start('trial', 176);
    expect(g.phase).toBe('battle');
    expect(g.player.hp).toBe(100);
    expect(g.maxHP).toBe(100);
    expect(g.skills.length).toBe(1);
    expect(g.skills[0].id).toBe('fireball');
    expect(g.level).toBe(1);
    expect(g.gold).toBe(0);
    expect(g.kills).toBe(0);
  });

  it('updates player movement and respects boundary clamping', () => {
    g.start('trial', 176);
    const initialX = g.player.x;
    const initialY = g.player.y;

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
    g.start('trial', 176);
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
    g.start('trial', 176);
    g.drops = [
      { id: 1, x: 100, y: 100, exp: 10, gold: 20, born: 0 },
      { id: 2, x: 200, y: 200, exp: 5, gold: 10, born: 0 },
    ];

    // Trigger endWave
    g.endWave();

    // Exp received: 10 + 5 = 15
    expect(g.exp).toBe(15);
    // Gold received: floor((20 + 10) * 0.5) = 15
    expect(g.gold).toBe(15);
    expect(g.drops.length).toBe(0);
    expect(g.phase).toBe('shop');
  });

  it('shop handles purchases, locking, and prevents negative gold', () => {
    g.start('trial', 176);
    g.gold = 100;
    g.endWave(); // Transitions to shop

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

  it('records telemetry and finishes on boss defeat or player death', () => {
    g.start('trial', 176);
    g.damageDealt = { fireball: 450, lightning: 820 };
    g.kills = 35;
    g.gold = 120;
    g.bossKilled = true;

    g.finish(true);

    expect(g.phase).toBe('won');
    expect(g.result).toBeDefined();
    expect(g.result?.won).toBe(true);
    expect(g.result?.kills).toBe(35);
    expect(g.result?.skillDamage.fireball).toBe(450);
    expect(g.result?.skillDamage.lightning).toBe(820);
  });
});
