import { assetUrl } from './utils';
import { fetchJsonWithCache, fetchBlobWithCache, getCachedAssetCount } from './cache';
import type { Manifest } from './types';
import { sound, MIR_AUDIO_MAP } from './audio';

export interface PreloadState {
  phase: 'idle' | 'loading' | 'complete' | 'error';
  progress: number; // 0 - 100
  loadedCount: number;
  totalCount: number;
  statusText: string;
  cachedCount: number;
  error?: string;
}

export let framePositions: Record<string, { x: number; y: number }> = {};
export let assetManifest: Manifest | null = null;

export const MIR_CORE_UI_ASSETS = [
  'mainbar.png',
  'mainbar_center.png',
  'mainbar_title.png',
  'mir2_frame_9slice.png',
  'mir2_stone_9slice.png',
  'mir2_dragon_relief.png',
  'quick_bar.png',
  'hp_ball.png',
  'mp_ball.png',
  'equip_panel.png',
  'skill_panel.png',
  'bag_panel.png',
  'lobby_bg.png',
  'dialog_bg.png',
  'btn_close.png',
  'btn_close_down.png',
  'btn_equip_off.png',
  'btn_equip_down.png',
  'btn_skill_off.png',
  'btn_skill_down.png',
  'btn_bag_off.png',
  'btn_bag_down.png',
  'btn_opt_off.png',
  'btn_opt_down.png',
];

const manifestListeners = new Set<(m: Manifest) => void>();

export function onManifestLoaded(fn: (m: Manifest) => void) {
  manifestListeners.add(fn);
  if (assetManifest) fn(assetManifest);
  return () => {
    manifestListeners.delete(fn);
  };
}

let state: PreloadState = {
  phase: 'idle',
  progress: 0,
  loadedCount: 0,
  totalCount: 45, // 1 manifest + 8 atlas jsons + 8 atlas pngs + 28 wav audios
  statusText: '准备加载玛法大陆核心资源...',
  cachedCount: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribePreload(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getPreloadState(): PreloadState {
  return state;
}

export function isAssetsReady(): boolean {
  return state.phase === 'complete';
}

export function forceCompletePreload() {
  state = {
    ...state,
    phase: 'complete',
    progress: 100,
    statusText: '核心资源已就绪',
  };
  notify();
}

let preloadPromise: Promise<void> | null = null;

/**
 * Preload essential art metadata and core UI into memory and local CacheStorage.
 * Atlas JSON metadata and core UI load concurrently within seconds so the game boots immediately.
 * Heavy atlas textures and audio warm up asynchronously in the background.
 */
export async function preloadAllAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    state = {
      ...state,
      phase: 'loading',
      progress: 0,
      loadedCount: 0,
      statusText: '正在读取玛法大陆核心索引...',
    };
    notify();

    try {
      const initialCached = await getCachedAssetCount();
      state.cachedCount = initialCached;

      // Step 1: Load manifest.json
      state.statusText = '正在加载玛法大陆世界地图与动作规范 (manifest.json)...';
      notify();

      const manifest = await fetchJsonWithCache<Manifest>(assetUrl('assets/mir/manifest.json?v=1.76-v3'));
      assetManifest = manifest;
      manifestListeners.forEach((fn) => fn(manifest));

      const totalItems = 1 + manifest.pages.length + MIR_CORE_UI_ASSETS.length;
      state.totalCount = totalItems;
      state.loadedCount = 1;
      state.progress = Math.round((state.loadedCount / state.totalCount) * 100);
      notify();

      framePositions = {};

      // Step 2: Concurrently load Atlas JSON metadata (definitions for icons and sprites)
      state.statusText = '正在解析图集定义规范...';
      notify();
      await Promise.all(
        manifest.pages.map(async (page, index) => {
          try {
            const atlasData = await fetchJsonWithCache<{ frames: Record<string, { frame: { x: number; y: number } }> }>(
              assetUrl('assets/mir/' + page.data)
            );
            if (atlasData?.frames) {
              for (const [key, val] of Object.entries(atlasData.frames)) {
                framePositions[key] = val.frame;
              }
            }
          } catch (e) {
            console.warn(`Could not load atlas data for ${page.key}:`, e);
          }
          state.loadedCount++;
          state.progress = Math.round((state.loadedCount / state.totalCount) * 100);
          notify();
        })
      );

      // Step 3: Concurrently preload Authentic Mir2 UI assets
      state.statusText = '正在载入热血传奇核心 UI 界面美术...';
      notify();
      await Promise.all(
        MIR_CORE_UI_ASSETS.map(async (uiFile) => {
          try {
            await fetchBlobWithCache(assetUrl('assets/mir/ui/' + uiFile));
          } catch (e) {
            console.warn(`UI asset preload error for ${uiFile}:`, e);
          }
          state.loadedCount++;
          state.progress = Math.round((state.loadedCount / state.totalCount) * 100);
          notify();
        })
      );

      // Core assets are now 100% ready for instant play
      const finalCached = await getCachedAssetCount();
      state.cachedCount = finalCached;
      state.phase = 'complete';
      state.progress = 100;
      state.statusText = `玛法核心美术已就绪！(已缓存 ${finalCached} 项)`;
      notify();

      // Step 4 (Non-blocking background warm-up): Warm up audio in background
      (async () => {
        try {
          const audioKeys = Object.keys(MIR_AUDIO_MAP);
          for (const key of audioKeys) {
            sound.preloadAudioKey(key).catch(() => {});
          }
        } catch {}
      })();
    } catch (err: any) {
      console.error('Preload failed:', err);
      state.phase = 'error';
      state.error = err?.message || '资源加载失败';
      state.statusText = '资源加载出错，点击可重试';
      notify();
    }
  })();

  return preloadPromise;
}

export function resetPreload() {
  preloadPromise = null;
  state = {
    phase: 'idle',
    progress: 0,
    loadedCount: 0,
    totalCount: 45,
    statusText: '准备加载玛法大陆核心资源...',
    cachedCount: 0,
  };
  notify();
}
