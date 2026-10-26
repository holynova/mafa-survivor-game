import { openDB } from 'idb';
import type { RunResult } from './types';

const DB_NAME = 'mafa-survivor-db';
const DB_VERSION = 1;

const db = () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('runs')) {
        database.createObjectStore('runs', { keyPath: 'runId' });
      }
    },
  });

export async function saveRun(result: RunResult) {
  try {
    const database = await db();
    const tx = database.transaction('runs', 'readwrite');
    const existing = await tx.store.get(result.runId);
    if (!existing) {
      await tx.store.add({ ...result, savedAt: Date.now() });
    }
    await tx.done;
    database.close();
  } catch (err) {
    console.warn('Failed to save run to IndexedDB:', err);
  }
}

export async function history(): Promise<RunResult[]> {
  try {
    const database = await db();
    const rows: RunResult[] = await database.getAll('runs');
    database.close();
    return rows.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)).slice(0, 15);
  } catch {
    return [];
  }
}
