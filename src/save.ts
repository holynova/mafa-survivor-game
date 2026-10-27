import { openDB } from 'idb';
import { TALENTS } from './content';
import type { HeroClass, MapChapter, ProfileData, RunResult, TalentKey } from './types';

const DB_NAME = 'mafa-survivor-db';
const DB_VERSION = 2;

const defaultProfile: ProfileData = {
  crystals: 100,
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

const LOCAL_STORAGE_KEY = 'mafa_survivor_profile_backup';

export function validateAndRepairProfile(raw: any): ProfileData {
  if (!raw || typeof raw !== 'object') {
    return { ...defaultProfile };
  }

  const crystals =
    typeof raw.crystals === 'number' && !isNaN(raw.crystals)
      ? Math.max(0, Math.floor(raw.crystals))
      : defaultProfile.crystals;

  const talents = { ...defaultProfile.talents };
  if (raw.talents && typeof raw.talents === 'object') {
    for (const def of TALENTS) {
      const val = raw.talents[def.key];
      if (typeof val === 'number' && !isNaN(val)) {
        talents[def.key] = Math.min(def.maxLevel, Math.max(0, Math.floor(val)));
      }
    }
  }

  const validChapters: MapChapter[] = ['bichon', 'mine', 'temple'];
  let unlockedChapters: MapChapter[] = ['bichon'];
  if (Array.isArray(raw.unlockedChapters)) {
    const valid = raw.unlockedChapters.filter((c: any) => validChapters.includes(c));
    if (valid.length > 0) {
      unlockedChapters = Array.from(new Set(['bichon', ...valid]));
    }
  }

  const validClasses: HeroClass[] = ['wizard', 'taoist', 'warrior'];
  let unlockedClasses: HeroClass[] = ['wizard', 'taoist', 'warrior'];
  if (Array.isArray(raw.unlockedClasses)) {
    const valid = raw.unlockedClasses.filter((c: any) => validClasses.includes(c));
    if (valid.length > 0) {
      unlockedClasses = Array.from(new Set(valid));
    }
  }

  let unlockedSkills: string[] = [...defaultProfile.unlockedSkills!];
  if (Array.isArray(raw.unlockedSkills)) {
    unlockedSkills = Array.from(
      new Set([
        ...unlockedSkills,
        ...raw.unlockedSkills.filter((s: any) => typeof s === 'string'),
      ])
    );
  }

  let unlockedEquipments: string[] = [...defaultProfile.unlockedEquipments!];
  if (Array.isArray(raw.unlockedEquipments)) {
    unlockedEquipments = Array.from(
      new Set([
        ...unlockedEquipments,
        ...raw.unlockedEquipments.filter((e: any) => typeof e === 'string'),
      ])
    );
  }

  return {
    crystals,
    talents,
    unlockedChapters,
    unlockedClasses,
    unlockedSkills,
    unlockedEquipments,
  };
}

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
  let profile: ProfileData = { ...defaultProfile };
  try {
    const database = await db();
    const row = await database.get('profile', 'main');
    database.close();
    if (row && row.data) {
      profile = validateAndRepairProfile(row.data);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      const local = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        profile = validateAndRepairProfile(JSON.parse(local));
      }
    }
  } catch {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const local = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) profile = validateAndRepairProfile(JSON.parse(local));
      }
    } catch {}
  }

  // Ensure 100 test crystals are granted to existing or returning profiles
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const granted = window.localStorage.getItem('mafa_test_crystals_100_v1');
      if (!granted) {
        window.localStorage.setItem('mafa_test_crystals_100_v1', 'true');
        if (profile.crystals < 100) {
          profile.crystals = 100;
          await saveProfile(profile);
        }
      }
    } catch {}
  }

  return profile;
}

export async function saveProfile(data: ProfileData): Promise<void> {
  const clean = validateAndRepairProfile(data);
  try {
    const database = await db();
    await database.put('profile', { id: 'main', data: clean });
    database.close();
  } catch (err) {
    console.warn('Failed to save profile to IndexedDB:', err);
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clean));
    }
  } catch {}
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
  tomb: 25,
  desert: 40,
};

export async function unlockAllChapters(): Promise<ProfileData> {
  const profile = await getProfile();
  profile.unlockedChapters = ['bichon', 'mine', 'temple', 'tomb', 'desert'];
  await saveProfile(profile);
  return profile;
}

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

export async function exportSaveData(): Promise<string> {
  const profile = await getProfile();
  const runs = await history();
  return JSON.stringify(
    {
      game: 'mafa-survivor',
      version: DB_VERSION,
      timestamp: Date.now(),
      profile,
      runs,
    },
    null,
    2
  );
}

export async function importSaveData(
  jsonString: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: '存档格式错误，无法解析' };
    }
    const profile = validateAndRepairProfile(parsed.profile ?? parsed);
    await saveProfile(profile);

    if (Array.isArray(parsed.runs)) {
      try {
        const database = await db();
        const tx = database.transaction('runs', 'readwrite');
        for (const run of parsed.runs) {
          if (run && typeof run === 'object' && run.runId) {
            await tx.store.put(run);
          }
        }
        await tx.done;
        database.close();
      } catch (err) {
        console.warn('Failed to restore runs from imported save:', err);
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: '存档 JSON 语法错误，导入失败' };
  }
}
