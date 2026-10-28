import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../src/game';
import type { Skill, Enemy } from '../src/types';

describe('Ground Health Potions and Gold Drop Mechanics', () => {
  let g: Game;

  beforeEach(() => {
    g = new Game();
    g.start();
  });

  it('restores HP on picking up a small health potion', () => {
    g.player.hp = 40;
    const maxHP = g.maxHP;
    g.drops.push({
      id: 99991,
      x: g.player.x,
      y: g.player.y,
      exp: 0,
      gold: 0,
      born: g.clock,
      isHeal: true,
      healType: 'small',
      healAmount: 35,
    });

    g.step(1 / 60);

    expect(g.player.hp).toBe(75);
    expect(g.drops.length).toBe(0);
    const healFloating = g.floating.find((f) => f.type === 'heal');
    expect(healFloating).toBeDefined();
    expect(healFloating?.text).toBe('+35 HP');
  });

  it('restores HP on picking up a big health potion and caps at maxHP', () => {
    g.player.hp = 80;
    const maxHP = g.maxHP;
    g.drops.push({
      id: 99992,
      x: g.player.x,
      y: g.player.y,
      exp: 0,
      gold: 0,
      born: g.clock,
      isHeal: true,
      healType: 'big',
      healAmount: 75,
    });

    g.step(1 / 60);

    expect(g.player.hp).toBe(maxHP);
    expect(g.drops.length).toBe(0);
    const healFloating = g.floating.find((f) => f.type === 'heal');
    expect(healFloating).toBeDefined();
    expect(healFloating?.text).toBe('+75 HP');
  });
});

describe('Magic Shield Style Preference', () => {
  let g: Game;

  beforeEach(() => {
    g = new Game();
  });

  it('defaults to golden eggshell shield and toggles to cyan', () => {
    expect(g.shieldStyle).toBe('golden');
    g.toggleShieldStyle();
    expect(g.shieldStyle).toBe('cyan');
    g.toggleShieldStyle();
    expect(g.shieldStyle).toBe('golden');
  });
});

describe('Evolved Skills FX Parameters for Enhanced Visuals', () => {
  let g: Game;

  beforeEach(() => {
    g = new Game();
    g.heroClass = 'wizard';
    g.start();
  });

  it('sets evolved: true and 550px length on evolved hellfire effect', () => {
    const hellfireSkill = {
      id: 'hellfire',
      name: '地狱火',
      cd: 0,
      baseCD: 1,
      damage: 16,
      radius: 0,
      desc: '',
      level: 1,
      maxLevel: 5,
      evolved: true,
      rank: 1,
      power: 16,
      count: 1,
      duration: 1,
      cooldown: 1,
      speed: 1,
    } as unknown as Skill;
    g.cast(hellfireSkill);
    const fx = g.effects.find((f) => f.kind === 'hellfire');
    expect(fx).toBeDefined();
    expect(fx?.evolved).toBe(true);
    expect(fx?.radius).toBe(550);
  });

  it('sets evolved: true and expanded radius on evolved ice storm effect', () => {
    g.enemies.push({
      id: 99993,
      x: g.player.x + 50,
      y: g.player.y,
      hp: 100,
      maxHp: 100,
      speed: 10,
      damage: 10,
      exp: 10,
      kind: 'orc',
      dir: 0,
      born: g.clock,
      hitAt: 0,
      windup: 0,
      status: { poisonedUntil: 0, poisonDamage: 0, poisonDefDown: 0, paralyzedUntil: 0 },
    } as unknown as Enemy);

    const iceSkill = {
      id: 'ice_storm',
      name: '冰咆哮',
      cd: 0,
      baseCD: 1,
      damage: 16,
      radius: 0,
      desc: '',
      level: 1,
      maxLevel: 5,
      evolved: true,
      rank: 1,
      power: 16,
      count: 1,
      duration: 1,
      cooldown: 1,
      speed: 1,
    } as unknown as Skill;
    g.cast(iceSkill);
    const fx = g.effects.find((f) => f.kind === 'ice_storm');
    expect(fx).toBeDefined();
    expect(fx?.evolved).toBe(true);
    expect(fx?.radius).toBe(180);
  });

  it('sets evolved: true and 240px radius on evolved thunderwave effect', () => {
    g.enemies.push(
      {
        id: 99994,
        x: g.player.x + 40,
        y: g.player.y,
        hp: 100,
        maxHp: 100,
        speed: 10,
        damage: 10,
        exp: 10,
        kind: 'orc',
        dir: 0,
        born: g.clock,
        hitAt: 0,
        windup: 0,
        status: { poisonedUntil: 0, poisonDamage: 0, poisonDefDown: 0, paralyzedUntil: 0 },
      } as unknown as Enemy,
      {
        id: 99995,
        x: g.player.x - 40,
        y: g.player.y,
        hp: 100,
        maxHp: 100,
        speed: 10,
        damage: 10,
        exp: 10,
        kind: 'orc',
        dir: 0,
        born: g.clock,
        hitAt: 0,
        windup: 0,
        status: { poisonedUntil: 0, poisonDamage: 0, poisonDefDown: 0, paralyzedUntil: 0 },
      } as unknown as Enemy
    );

    const thunderSkill = {
      id: 'thunderwave',
      name: '地狱雷光',
      cd: 0,
      baseCD: 1,
      damage: 13,
      radius: 0,
      desc: '',
      level: 1,
      maxLevel: 5,
      evolved: true,
      rank: 1,
      power: 13,
      count: 1,
      duration: 1,
      cooldown: 1,
      speed: 1,
    } as unknown as Skill;
    g.cast(thunderSkill);
    const fx = g.effects.find((f) => f.kind === 'thunderwave');
    expect(fx).toBeDefined();
    expect(fx?.evolved).toBe(true);
    expect(fx?.radius).toBe(240);
  });
});
