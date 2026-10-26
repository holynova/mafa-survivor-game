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
  validateAndRepairProfile,
  exportSaveData,
  importSaveData,
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

  it('unlocks subsequent chapter on victory', async () => {
    const g = new Game();
    g.start('wizard', 'bichon', 'normal', 176);
    g.finish(true);
    await saveRun(g.result!);

    let prof = await getProfile();
    expect(prof.unlockedChapters).toContain('mine');

    // Winning mine unlocks temple
    const g2 = new Game();
    g2.start('wizard', 'mine', 'normal', 177);
    g2.finish(true);
    await saveRun(g2.result!);

    prof = await getProfile();
    expect(prof.unlockedChapters).toContain('temple');
  });

  it('allows unlocking chapters with crystals', async () => {
    await addCrystals(20);
    const { unlockChapter } = await import('../src/save');

    const res = await unlockChapter('temple', true);
    expect(res.success).toBe(true);

    const prof = await getProfile();
    expect(prof.unlockedChapters).toContain('temple');
    expect(prof.crystals).toBe(8); // 20 - 12 = 8
  });

  it('safely repairs corrupted profile data without throwing', () => {
    // Completely broken/corrupted payload
    const corrupt = {
      crystals: -50,
      talents: { robustness: 999, unknownKey: 5 },
      unlockedChapters: ['invalid_chap', 'bichon'],
      unlockedClasses: 'not_an_array',
      unlockedSkills: null,
    };

    const repaired = validateAndRepairProfile(corrupt);

    // Crystals cannot be negative
    expect(repaired.crystals).toBe(0);
    // Robustness must be clamped to maxLevel (5)
    expect(repaired.talents.robustness).toBe(5);
    // Missing talents populated with 0
    expect(repaired.talents.swiftness).toBe(0);
    // Only valid chapters preserved
    expect(repaired.unlockedChapters).toEqual(['bichon']);
    // Fallback to all 3 classes
    expect(repaired.unlockedClasses).toEqual(['wizard', 'taoist', 'warrior']);
    // Fallback to base starting skills
    expect(repaired.unlockedSkills?.length).toBeGreaterThan(0);
  });

  it('exports and imports save data cleanly', async () => {
    const profBefore = await getProfile();
    const expectedCrystals = profBefore.crystals;
    const g = new Game();
    g.start('taoist', 'bichon', 'trial', 176);
    g.finish(true);
    await saveRun(g.result!);

    // Export save
    const jsonStr = await exportSaveData();
    expect(jsonStr).toContain('mafa-survivor');
    expect(jsonStr).toContain('"profile"');

    // Simulate clean state
    await saveProfile({
      crystals: 0,
      talents: { robustness: 0, swiftness: 0, magnetism: 0, wealth: 0, enlightenment: 0, harmony: 0 },
      unlockedChapters: ['bichon'],
      unlockedClasses: ['wizard', 'taoist', 'warrior'],
    });

    let cleanProf = await getProfile();
    expect(cleanProf.crystals).toBe(0);

    // Import previously exported save
    const importRes = await importSaveData(jsonStr);
    expect(importRes.success).toBe(true);

    const restoredProf = await getProfile();
    expect(restoredProf.crystals).toBeGreaterThanOrEqual(expectedCrystals);

    // Invalid JSON import test
    const badRes = await importSaveData('{"invalid json');
    expect(badRes.success).toBe(false);
    expect(badRes.error).toBeDefined();
  });
});
