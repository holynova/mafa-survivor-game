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

    it('upgrades summon skeleton with branch to summon 2 skeletons simultaneously', () => {
      g.start('taoist', 'mine', 'trial', 176);
      const skelSkill = g.newSkill('summon_skeleton');
      g.skills.push(skelSkill);

      // Choose upgrade branch: 变异双骨 (summonLimit + 1)
      g.phase = 'upgrade';
      g.choices = [
        {
          id: 'summon_skeleton-lim',
          kind: 'skill',
          skill: 'summon_skeleton',
          name: '召唤骷髅 · 变异双骨',
          description: '变异骷髅召唤上限由 1 只提升至 2 只！',
          field: 'summonLimit',
          value: 1,
        },
      ];
      g.choose('summon_skeleton-lim');

      expect(skelSkill.rank).toBe(2);
      expect(skelSkill.summonLimit).toBe(2);

      // Now cast twice to summon 2 skeletons
      g.phase = 'battle';
      g.cast(skelSkill);
      skelSkill.cd = 0;
      g.cast(skelSkill);

      expect(g.minions.filter((m) => m.kind === 'skeleton')).toHaveLength(2);
    });
  });

  describe('Chapter Boss Mechanics (Bichon, Mine, Temple)', () => {
    it('Skull Elf (boss_bichon) enrages with increased speed when HP drops below 50%', () => {
      g.start('wizard', 'bichon', 'trial', 176);
      g.spawnEnemy('boss_bichon');
      const boss = g.enemies.find((e) => e.kind === 'boss_bichon')!;
      const baseSpeed = boss.speed;

      // Drop HP to 40%
      boss.hp = Math.round(boss.maxHp * 0.4);
      g.step(0.1);

      expect(boss.speed).toBeGreaterThan(baseSpeed);
    });

    it('Corpse King (boss_mine) triggers earthquake slam and summons zombie/maggot minions', () => {
      g.start('taoist', 'mine', 'trial', 176);
      g.spawnEnemy('boss_mine');
      const boss = g.enemies.find((e) => e.kind === 'boss_mine')!;
      boss.shootCD = 0; // ready to cast
      boss.x = g.player.x + 100;
      boss.y = g.player.y;

      const playerStartHp = g.player.hp;
      g.step(0.1);

      // Boss casts earthquake slam damaging nearby player and summons minions
      expect(g.player.hp).toBeLessThan(playerStartHp);
      expect(g.enemies.some((e) => e.kind === 'zombie')).toBe(true);
      expect(g.enemies.some((e) => e.kind === 'maggot')).toBe(true);
    });

    it('Woma Leader (boss_temple) teleports near player and radiates 8 lightning orbs', () => {
      g.start('warrior', 'temple', 'trial', 176);
      g.spawnEnemy('boss_temple');
      const boss = g.enemies.find((e) => e.kind === 'boss_temple')!;
      boss.shootCD = 0; // ready
      boss.x = 200;
      boss.y = 200;

      g.step(0.1);

      // Boss teleported close to player
      const distToPlayer = Math.hypot(boss.x - g.player.x, boss.y - g.player.y);
      expect(distToPlayer).toBeLessThan(300);

      // Emitted 8 radial lightning projectiles
      const enemyProjectiles = g.projectiles.filter((p) => p.isEnemy);
      expect(enemyProjectiles.length).toBeGreaterThanOrEqual(8);
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
