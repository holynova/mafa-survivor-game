import { openDB } from 'idb';
import { TALENTS } from './content';
import type { HeroClass, MapChapter, ProfileData, RunResult, TalentKey } from './types';

const DB_NAME = 'mafa-survivor-db';
const DB_VERSION = 2;

const defaultProfile: ProfileData = {
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
  unlockedSkills: ['fireball', 'heal_self', 'basic_swordplay'],
  unlockedEquipments: ['wpn-wood', 'arm-cloth-m', 'arm-cloth-f'],
};

const db = () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (!database.objectStoreNames.contains('runs')) {
        database.createObjectStore('runs', { keyPath: 'runId' });
      }
      if (!database.objectStoreNames.contains('profile')) {
        database.createObjectStore('profile', { keyPath: 'id' });
      }
    },
  });

export async function getProfile(): Promise<ProfileData> {
  try {
    const database = await db();
    const row = await database.get('profile', 'main');
    database.close();
    if (row && row.data) {
      return {
        ...defaultProfile,
        ...row.data,
        talents: { ...defaultProfile.talents, ...(row.data.talents || {}) },
      };
    }
    return defaultProfile;
  } catch {
    return defaultProfile;
  }
}

export async function saveProfile(data: ProfileData): Promise<void> {
  try {
    const database = await db();
    await database.put('profile', { id: 'main', data });
    database.close();
  } catch (err) {
    console.warn('Failed to save profile to IndexedDB:', err);
  }
}

export async function addCrystals(amount: number): Promise<ProfileData> {
  const profile = await getProfile();
  profile.crystals += amount;
  await saveProfile(profile);
  return profile;
}

export async function upgradeTalent(key: TalentKey): Promise<ProfileData> {
  const profile = await getProfile();
  const def = TALENTS.find((t) => t.key === key);
  if (!def) return profile;

  const currentLevel = profile.talents[key] || 0;
  if (currentLevel >= def.maxLevel) return profile;

  const cost = def.costPerLevel * (currentLevel + 1);
  if (profile.crystals < cost) return profile;

  profile.crystals -= cost;
  profile.talents[key] = currentLevel + 1;
  await saveProfile(profile);
  return profile;
}

export async function resetTalents(): Promise<ProfileData> {
  const profile = await getProfile();
  let refunded = 0;
  for (const [k, lvl] of Object.entries(profile.talents)) {
    const def = TALENTS.find((t) => t.key === k);
    if (def) {
      for (let i = 1; i <= lvl; i++) {
        refunded += def.costPerLevel * i;
      }
    }
  }
  profile.crystals += refunded;
  profile.talents = {
    robustness: 0,
    swiftness: 0,
    magnetism: 0,
    wealth: 0,
    enlightenment: 0,
    harmony: 0,
  };
  await saveProfile(profile);
  return profile;
}

export const CHAPTER_UNLOCK_COSTS: Record<MapChapter, number> = {
  bichon: 0,
  mine: 5,
  temple: 12,
};

export async function unlockChapter(
  chapter: MapChapter,
  useCrystals = false
): Promise<{ success: boolean; reason?: string }> {
  const profile = await getProfile();
  if (profile.unlockedChapters.includes(chapter)) {
    return { success: true };
  }
  const cost = CHAPTER_UNLOCK_COSTS[chapter] ?? 10;
  if (useCrystals) {
    if (profile.crystals < cost) {
      return { success: false, reason: `玛法结晶不足，需要 ${cost} 颗结晶` };
    }
    profile.crystals -= cost;
  }
  profile.unlockedChapters.push(chapter);
  await saveProfile(profile);
  return { success: true };
}

export async function saveRun(result: RunResult) {
  try {
    const database = await db();
    const tx = database.transaction('runs', 'readwrite');
    const existing = await tx.store.get(result.runId);
    let isNew = false;
    if (!existing) {
      await tx.store.add({ ...result, savedAt: Date.now() });
      isNew = true;
    }
    await tx.done;
    database.close();

    // Grant crystals and unlock next chapter on run completion only if newly saved
    if (isNew) {
      if (result.crystals > 0) {
        await addCrystals(result.crystals);
      }
      const profile = await getProfile();
      let profileUpdated = false;

      // Update Compendium unlocks
      const rawSkills = result.skillIds || result.skills;
      if (rawSkills && rawSkills.length > 0) {
        const skillsSet = new Set(profile.unlockedSkills || defaultProfile.unlockedSkills);
        for (const s of rawSkills) {
          if (!skillsSet.has(s)) {
            skillsSet.add(s);
            profileUpdated = true;
          }
        }
        profile.unlockedSkills = Array.from(skillsSet);
      }
      if (result.equipments && result.equipments.length > 0) {
        const eqSet = new Set(profile.unlockedEquipments || defaultProfile.unlockedEquipments);
        for (const eq of result.equipments) {
          if (!eqSet.has(eq)) {
            eqSet.add(eq);
            profileUpdated = true;
          }
        }
        profile.unlockedEquipments = Array.from(eqSet);
      }

      if (result.won) {
        const nextChapter: MapChapter | null =
          result.chapter === 'bichon' ? 'mine' : result.chapter === 'mine' ? 'temple' : null;
        if (nextChapter && !profile.unlockedChapters.includes(nextChapter)) {
          profile.unlockedChapters.push(nextChapter);
          profileUpdated = true;
        }
      }

      if (profileUpdated) {
        await saveProfile(profile);
      }
    }
  } catch (err) {
    console.warn('Failed to save run to IndexedDB:', err);
  }
}

export async function history(): Promise<RunResult[]> {
  try {
    const database = await db();
    const rows: RunResult[] = await database.getAll('runs');
    database.close();
    return rows.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)).slice(0, 20);
  } catch {
    return [];
  }
}
