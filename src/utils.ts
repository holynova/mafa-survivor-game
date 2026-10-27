export function assetUrl(path: string): string {
  const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : null;
  const base = meta && meta.env && meta.env.BASE_URL ? meta.env.BASE_URL : '/';
  const cleanBase = base.endsWith('/') ? base : base + '/';
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${cleanBase}${cleanPath}`;
}
