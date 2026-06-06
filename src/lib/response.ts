const LONG_EDGE_CACHE = 'public, s-maxage=2592000, stale-while-revalidate=86400';

export const NOINDEX_FOLLOW = 'noindex, follow';

export function setNoindexFollow(headers: Headers): void {
  headers.set('X-Robots-Tag', NOINDEX_FOLLOW);
}

export function setLongEdgeCache(headers: Headers): void {
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.set('CDN-Cache-Control', LONG_EDGE_CACHE);
  headers.set('Vercel-CDN-Cache-Control', LONG_EDGE_CACHE);
}

export function setNoSharedCache(headers: Headers): void {
  headers.set('Cache-Control', 'private, no-store');
  headers.delete('CDN-Cache-Control');
  headers.delete('Vercel-CDN-Cache-Control');
}
