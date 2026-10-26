import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../src/game';
import {
  getProfile,
  saveProfile,
  saveRun,
  history,
  addCrystals,
  upgradeTalent,
  resetTalents,
} from '../src/save';

describe('IndexedDB Save, Profile & Talent Shrine Persistence', () => {
  beforeEach(async () => {
    // Reset profile to default
    await saveProfile({
      crystals: 0,
      talents: {
        robustness: 0,
        swiftness: 0,
        magnetism: 0,
        wealth: 0,
        enlightenment: 0,
        harmony: 0,
      },
      unlockedChapters: ['bichon'],
      unlockedClasses: ['wizard', 'taoist', 'warrior'],
    });
  });

  it('persists a run exactly once, avoiding duplicate entries', async () => {
    const g = new Game();
    g.start('wizard', 'bichon', 'normal', 176);
    g.finish(true);
    const r = g.result!;

    await Promise.all([saveRun(r), saveRun(r), saveRun(r)]);
    const runs = await history();
    const matches = runs.filter((x) => x.runId === r.runId);

    expect(matches).toHaveLength(1);
    expect(matches[0].won).toBe(true);
    expect(matches[0].crystals).toBe(6);

    const prof = await getProfile();
    expect(prof.crystals).toBe(6);
  });

  it('handles talent upgrades and 100% crystal refund on reset', async () => {
    await addCrystals(20);
    let prof = await getProfile();
    expect(prof.crystals).toBe(20);

    // Upgrade robustness (costPerLevel: 3 * 1 = 3)
    prof = await upgradeTalent('robustness');
    expect(prof.talents.robustness).toBe(1);
    expect(prof.crystals).toBe(17);

    // Upgrade robustness again (cost: 3 * 2 = 6)
    prof = await upgradeTalent('robustness');
    expect(prof.talents.robustness).toBe(2);
    expect(prof.crystals).toBe(11);

    // Reset talents -> should refund 3 + 6 = 9 crystals
    prof = await resetTalents();
    expect(prof.talents.robustness).toBe(0);
    expect(prof.crystals).toBe(20);
  });
});
