import { describe, expect, it, vi } from 'vitest';
import { getPageEdgeCacheTtl, setPageCache } from './response';

describe('getPageEdgeCacheTtl', () => {
  it('caches historic pages for 30 days', () => {
    expect(getPageEdgeCacheTtl(2025, 2026, false)).toBe(2592000);
  });

  it('caches the active race for 15 minutes', () => {
    expect(getPageEdgeCacheTtl(2026, 2026, true)).toBe(900);
  });

  it('caches other current-season pages for one day', () => {
    expect(getPageEdgeCacheTtl(2026, 2026, false)).toBe(86400);
  });
});

describe('setPageCache', () => {
  it('keeps the browser TTL at zero while setting a shared-cache TTL', () => {
    const headers = new Headers();
    const cache = { set: vi.fn() };

    setPageCache(headers, cache, 2025, false, 2026);

    expect(cache.set).toHaveBeenCalledWith({ maxAge: 2592000 });
    expect(headers.get('Cloudflare-CDN-Cache-Control')).toBe('max-age=2592000');
    expect(headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=2592000');
  });
});
