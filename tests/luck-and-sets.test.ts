import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { mutateSuperiorEquipment, getItem } from '../src/content';

describe('Luck-9 (运9套) System', () => {
  it('calculates totalLuck from weapon, necklace, and affixes', () => {
    const g = new Game();
    g.start('wizard', 'bichon');
    // Default starting weapon is wpn-wood with 0 luck
    expect(g.totalLuck).toBe(0);

    // Equip lucky weapon
    g.equipment.weapon = {
      itemId: 'wpn-bone-staff',
      paid: 1100,
      luck: 7,
    };
    expect(g.totalLuck).toBe(7);

    // Equip necklace with luck +2 (e.g. memory necklace)
    g.equipment.necklace = {
      itemId: 'neck-memory',
      paid: 950,
      luck: 2,
    };
    expect(g.totalLuck).toBe(9);
  });

  it('guarantees max damage roll when totalLuck >= 9', () => {
    const g = new Game();
    g.start('wizard', 'bichon');
    const skill = g.skills[0];

    // Under Luck 9, rollRatio is fixed to 1.0 (100% max roll)
    g.equipment.weapon = { itemId: 'wpn-bone-staff', paid: 1100, luck: 7 };
    g.equipment.necklace = { itemId: 'neck-memory', paid: 950, luck: 2 };
    expect(g.totalLuck).toBe(9);

    const dmg1 = g.calcDamage('wizard', 10, skill);
    const dmg2 = g.calcDamage('wizard', 10, skill);
    // Since rollRatio is 1.0 every time, base non-crit damage is guaranteed constant max
    expect(dmg1).toBe(dmg2);
  });

  it('uses blessing oil to increase weapon luck up to 7', () => {
    const g = new Game();
    g.start('warrior', 'bichon');
    g.equipment.weapon = { itemId: 'wpn-wood', paid: 0, luck: 0 };

    // Valid to buy oil
    const oil = getItem('blessing-oil');
    expect(g.validItem(oil)).toBe(true);

    // Apply blessing oil
    let attempts = 0;
    while ((g.equipment.weapon.luck ?? 0) < 7 && attempts < 100) {
      g.useBlessingOil();
      attempts++;
    }

    expect(g.equipment.weapon.luck).toBe(7);
    // When weapon luck is 7, validItem returns false
    expect(g.validItem(oil)).toBe(false);
  });
});

describe('Superior Affix Mutation (极品词条突变)', () => {
  it('mutates an item into a superior version with affixes and bonus stats', () => {
    const baseItem = getItem('wpn-silver-snake');
    const mutated = mutateSuperiorEquipment(baseItem, () => 0.5);

    expect(mutated.isSuperior).toBe(true);
    expect(mutated.affixes).toBeDefined();
    expect(mutated.affixes!.length).toBeGreaterThan(0);
    expect(mutated.price).toBeGreaterThan(baseItem.price);
  });
});

describe('Equipment Set Resonance (套装羁绊)', () => {
  it('activates Hongmo (虹魔) set resonance bonuses when 2 and 3 pieces equipped', () => {
    const g = new Game();
    g.start('warrior', 'bichon');
    expect(g.stats.lifesteal ?? 0).toBe(0);

    // Equip 2 Hongmo pieces
    g.equipment.necklace = { itemId: 'neck-hongmo', paid: 650 };
    g.equipment.braceletL = { itemId: 'brac-hongmo', paid: 650 };
    g.recompute();

    // 2-piece set bonus gives +5% lifesteal (+ item base lifesteals 3% + 2% = 10%)
    expect(g.stats.lifesteal).toBe(10);
    expect(g.activeSetBonuses.some((b) => b.setKey === 'hongmo' && b.pieces === 2)).toBe(true);

    // Equip 3rd Hongmo piece
    g.equipment.ringL = { itemId: 'ring-hongmo', paid: 650 };
    g.recompute();

    // Cumulative set bonuses: 2-piece (+5%) + 3-piece (+10%) + items (3% + 2% + 2%) = 22%
    // And +15% move speed from set bonus
    expect(g.stats.lifesteal).toBe(22);
    expect(g.activeSetBonuses.some((b) => b.setKey === 'hongmo' && b.pieces === 3)).toBe(true);
  });

  it('activates Moxue (魔血) set resonance bonuses', () => {
    const g = new Game();
    g.start('wizard', 'bichon');
    const initialHP = g.maxHP;

    // Equip 2 Moxue pieces
    g.equipment.necklace = { itemId: 'neck-moxue', paid: 650 };
    g.equipment.braceletL = { itemId: 'brac-moxue', paid: 650 };
    g.recompute();

    // 2 pieces: +60 HP max from set bonus + 60 HP from 2 items = +120 HP max
    expect(g.maxHP).toBe(initialHP + 120);
    expect(g.stats.def_flat).toBeGreaterThanOrEqual(6);
  });
});
