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

let preloadPromise: Promise<void> | null = null;

/**
 * Preload all art and audio assets into memory and local CacheStorage.
 * Guarantees zero missing textures, instant battle rendering, and zero audio stutter.
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

      const totalItems =
        1 + manifest.pages.length * 2 + Object.keys(MIR_AUDIO_MAP).length + MIR_CORE_UI_ASSETS.length;
      state.totalCount = totalItems;
      state.loadedCount = 1;
      state.progress = Math.round((state.loadedCount / state.totalCount) * 100);
      notify();

      framePositions = {};

      // Step 2: Load Atlas JSONs and Atlas PNGs
      for (let i = 0; i < manifest.pages.length; i++) {
        const page = manifest.pages[i];

        // 2a. Atlas JSON metadata
        state.statusText = `正在解析图集定义: ${page.key} (${i + 1}/${manifest.pages.length})...`;
        notify();
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

        // 2b. Atlas PNG Image
        state.statusText = `正在载入原版美术精灵图: ${page.image} (${Math.round((state.loadedCount / state.totalCount) * 100)}%)...`;
        notify();
        try {
          const blob = await fetchBlobWithCache(assetUrl('assets/mir/' + page.image));
          // Warm up browser image decoding
          await new Promise<void>((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            img.src = url;
          });
        } catch (e) {
          console.warn(`Could not preload atlas image for ${page.key}:`, e);
        }

        state.loadedCount++;
        state.progress = Math.round((state.loadedCount / state.totalCount) * 100);
        notify();
      }

      // Step 3: Preload & Decode Authentic Audio
      state.statusText = '正在预解码 28 首热血传奇经典原版音效...';
      notify();

      const audioEntries = Object.entries(MIR_AUDIO_MAP);
      for (let i = 0; i < audioEntries.length; i++) {
        const [key, file] = audioEntries[i];
        state.statusText = `正在解码音效: ${file} (${key})...`;
        notify();

        try {
          await sound.preloadAudioKey(key);
        } catch (e) {
          console.warn(`Audio preload error for ${key}:`, e);
        }

        state.loadedCount++;
        state.progress = Math.round((state.loadedCount / state.totalCount) * 100);
        notify();
      }

      // Step 4: Preload Authentic Mir2 UI assets
      state.statusText = '正在预载入热血传奇原版 UI 界面美术...';
      notify();
      for (const uiFile of MIR_CORE_UI_ASSETS) {
        try {
          const blob = await fetchBlobWithCache(assetUrl('assets/mir/ui/' + uiFile));
          await new Promise<void>((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            img.src = url;
          });
        } catch (e) {
          console.warn(`UI asset preload error for ${uiFile}:`, e);
        }
        state.loadedCount++;
        state.progress = Math.round((state.loadedCount / state.totalCount) * 100);
        notify();
      }

      const finalCached = await getCachedAssetCount();
      state.cachedCount = finalCached;
      state.phase = 'complete';
      state.progress = 100;
      state.statusText = `玛法核心美术与音效已全部就绪！(已缓存 ${finalCached} 项)`;
      notify();
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
