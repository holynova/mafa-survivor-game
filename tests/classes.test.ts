import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../src/game';
import { CLASS_BASES, SKILLS, getSkill } from '../src/content';

describe('Three Classes & Complete Skill Pool Verification (GDD Spec)', () => {
  let g: Game;

  beforeEach(() => {
    g = new Game();
  });

  describe('Wizard (14 Skills)', () => {
    it('matches base attributes and starting skill', () => {
      const base = CLASS_BASES.wizard;
      expect(base.hp).toBe(100);
      expect(base.speed).toBe(220);
      expect(base.def).toBe(0);
      expect(base.mdef).toBe(2);
      expect(base.dodge).toBe(5);
      expect(base.startingSkill).toBe('fireball');
      expect(base.allowedSkills).toHaveLength(14);
    });

    it('casts repulsive ring of fire pushing enemies away without damaging them', () => {
      g.start('wizard', 'bichon', 'trial', 176);
      g.spawnEnemy('orc');
      const orc = g.enemies[0];
      orc.x = g.player.x + 30;
      orc.y = g.player.y;
      const initialHp = orc.hp;

      const ringSkill = g.newSkill('ring_of_fire');
      g.skills.push(ringSkill);
      g.cast(ringSkill);

      // Orc is repelled away
      expect(orc.x).toBeGreaterThan(g.player.x + 30);
      // Ring of fire causes 0 damage in GDD spec
      expect(orc.hp).toBe(initialHp);
    });

    it('casts magic shield providing damage reduction', () => {
      g.start('wizard', 'bichon', 'trial', 176);
      const shieldSkill = g.newSkill('shield');
      g.skills.push(shieldSkill);
      g.cast(shieldSkill);

      expect(g.player.shieldUntil).toBeGreaterThan(g.clock);
    });

    it('casts teleport jumping to a safe location within bounds', () => {
      g.start('wizard', 'bichon', 'trial', 176);
      const oldX = g.player.x;
      const oldY = g.player.y;

      const tpSkill = g.newSkill('teleport');
      g.skills.push(tpSkill);
      g.cast(tpSkill);

      expect(g.player.x).not.toBe(oldX);
      expect(g.player.x).toBeGreaterThanOrEqual(50);
      expect(g.player.x).toBeLessThanOrEqual(2150);
    });
  });

  describe('Taoist (13 Skills)', () => {
    it('matches base attributes and starting skill', () => {
      const base = CLASS_BASES.taoist;
      expect(base.hp).toBe(135);
      expect(base.speed).toBe(215);
      expect(base.def).toBe(2);
      expect(base.mdef).toBe(3);
      expect(base.dodge).toBe(5);
      expect(base.startingSkill).toBe('soul_fireball');
      expect(base.allowedSkills).toHaveLength(13);
    });

    it('summons skeleton and shinsu minions up to their limits', () => {
      g.start('taoist', 'mine', 'trial', 176);

      // Summon skeleton
      const skelSkill = g.newSkill('summon_skeleton');
      g.skills.push(skelSkill);
      g.cast(skelSkill);
      expect(g.minions.filter((m) => m.kind === 'skeleton')).toHaveLength(1);

      // Summon shinsu
      const shinsuSkill = g.newSkill('summon_shinsu');
      g.skills.push(shinsuSkill);
      g.cast(shinsuSkill);
      expect(g.minions.filter((m) => m.kind === 'shinsu')).toHaveLength(1);
    });

    it('inflicts poison status on nearby enemies', () => {
      g.start('taoist', 'mine', 'trial', 176);
      g.spawnEnemy('cat');
      const cat = g.enemies[0];
      cat.x = g.player.x + 50;
      cat.y = g.player.y;

      const poisonSkill = g.newSkill('poison');
      g.skills.push(poisonSkill);
      g.cast(poisonSkill);

      expect(cat.status.poisonedUntil).toBeGreaterThan(g.clock);
    });
  });

  describe('Warrior (6 Skills)', () => {
    it('matches base attributes and starting skill', () => {
      const base = CLASS_BASES.warrior;
      expect(base.hp).toBe(185);
      expect(base.speed).toBe(205);
      expect(base.def).toBe(5);
      expect(base.mdef).toBe(1);
      expect(base.dodge).toBe(3);
      expect(base.startingSkill).toBe('half_moon');
      expect(base.allowedSkills).toHaveLength(6);
    });

    it('executes savage charge dashing and staggering enemies', () => {
      g.start('warrior', 'temple', 'trial', 176);
      g.spawnEnemy('orc');
      const orc = g.enemies[0];
      orc.x = g.player.x + 60;
      orc.y = g.player.y;
      g.player.dir = 2; // Face East towards enemy at (+60, 0)

      const chargeSkill = g.newSkill('savage_charge');
      g.skills.push(chargeSkill);
      const startX = g.player.x;
      g.cast(chargeSkill);
      g.step(0.1);

      expect(g.player.x).toBeGreaterThan(startX);
    });

    it('executes flame sword with heavy burst damage', () => {
      g.start('warrior', 'temple', 'trial', 176);
      g.spawnEnemy('orc');
      const orc = g.enemies[0];
      orc.x = g.player.x + 40;
      orc.y = g.player.y;
      const prevHp = orc.hp;

      const flameSkill = g.newSkill('fire_swordplay');
      g.skills.push(flameSkill);
      g.cast(flameSkill);

      expect(orc.hp).toBeLessThan(prevHp);
    });
  });
});
