import { describe, it, expect } from 'vitest';
import { Game } from '../src/game';
import { SkillId } from '../src/types';

describe('Wizard 3-skills combat test', () => {
  const wizardSkillCombos: [SkillId, SkillId, SkillId][] = [
    ['fireball', 'lightning', 'hellfire'],
    ['fireball', 'ring_of_fire', 'firewall'],
    ['fireball', 'firebang', 'ice_storm'],
    ['fireball', 'laser', 'thunderwave'],
    ['fireball', 'great_fireball', 'entice'],
    ['fireball', 'shield', 'holy_word'],
  ];

  for (const combo of wizardSkillCombos) {
    it(`should cast all 3 skills in combo: ${combo.join(', ')}`, () => {
      const g = new Game();
      g.start('wizard', 'bichon', 'normal', 176);
      g.skills = [g.newSkill(combo[0]), g.newSkill(combo[1]), g.newSkill(combo[2])];

      // Spawn a wave of enemies around the player
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const dist = 50 + (i % 3) * 50; // Some in melee (50), some mid-range (100, 150)
        g.enemies.push({
          id: 100 + i,
          kind: 'skeleton',
          name: '骷髅',
          x: g.player.x + Math.cos(angle) * dist,
          y: g.player.y + Math.sin(angle) * dist,
          hp: 200,
          maxHp: 200,
          speed: 25,
          damage: 2,
          exp: 5,
          dir: 4,
          windup: 0,
          attackCD: 0,
          shootCD: 0,
          hitAt: -1,
          burnAt: 0,
          elite: false,
          undead: true,
          born: g.clock,
          aiType: 'melee',
          status: { poisonedUntil: 0, poisonDamage: 0, poisonDefDown: 0, paralyzedUntil: 0 },
        });
      }

      // Simulate 10 seconds of combat (600 frames)
      const casts: Record<string, number> = {};
      const origCast = g.cast.bind(g);
      g.cast = (s) => {
        casts[s.id] = (casts[s.id] ?? 0) + 1;
        origCast(s);
      };

      for (let f = 0; f < 600; f++) {
        g.step(1 / 60);
      }

      console.log(`Combo [${combo.join(', ')}] cast counts:`, casts);
      console.log(`Damage dealt:`, g.damageDealt);
      console.log(`Projectiles: ${g.projectiles.length}, Effects: ${g.effects.length}, Minions: ${g.minions.length}`);

      // Verify that all 3 skills in the combo were cast at least once
      for (const skillId of combo) {
        expect(casts[skillId] ?? 0).toBeGreaterThan(0);
      }
    });
  }
});
