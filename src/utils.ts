export function assetUrl(path: string): string {
  const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : null;
  let base = meta?.env?.BASE_URL || '/';

  // Runtime safety check for GitHub Pages or subpath hosting
  if (typeof window !== 'undefined' && window.location?.pathname) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && parts[0] === 'mafa-survivor-game') {
      base = '/mafa-survivor-game/';
    }
  }

  const cleanBase = base.endsWith('/') ? base : base + '/';
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${cleanBase}${cleanPath}`;
}
