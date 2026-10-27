/**
 * Persistent Cache Storage for Legend of Mir 2 Art & Audio Assets
 * Prevents redundant network requests across page reloads and game sessions.
 */

export const ASSET_CACHE_NAME = 'mir2-assets-cache-v1';

export async function fetchWithCache(url: string, init?: RequestInit): Promise<Response> {
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(ASSET_CACHE_NAME);
      const matched = await cache.match(url);
      if (matched) {
        return matched.clone();
      }
      const response = await fetch(url, init);
      if (response.ok) {
        // Cache the response clone for future sessions
        cache.put(url, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      // Fallback on network if cache fails
    }
  }
  return fetch(url, init);
}

export async function fetchJsonWithCache<T>(url: string): Promise<T> {
  const res = await fetchWithCache(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchBlobWithCache(url: string): Promise<Blob> {
  const res = await fetchWithCache(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.blob();
}

export async function getCachedAssetCount(): Promise<number> {
  if (typeof window === 'undefined' || !('caches' in window)) return 0;
  try {
    const cache = await caches.open(ASSET_CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

export async function clearAssetCache(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    return await caches.delete(ASSET_CACHE_NAME);
  } catch {
    return false;
  }
}
