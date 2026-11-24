import { describe, expect, it } from 'vitest';
import { JOLPICA_USER_AGENT } from '../jolpica_api';
import {
  canSkipFailedDumpCheck,
  dumpAgeDays,
  fetchDelayedCsvDump,
  fetchWithRetry,
  getDelayedCsvDump,
  hasNewDump,
  JolpicaHttpError,
  type JolpicaDumpState,
  MAX_DUMP_AGE_DAYS,
} from '../jolpica_dump';

const currentState: JolpicaDumpState = {
  dump_type: 'csv',
  file_hash: 'existing-hash',
  file_size: 123,
  uploaded_at: '2026-05-01T00:00:00.000000Z',
  source: 'test',
};

describe('Jolpica dump update checks', () => {
  it('uses the delayed CSV dump from the overview response', () => {
    const dump = getDelayedCsvDump({
      delayed_dumps: {
        csv: {
          dump_type: 'csv',
          file_hash: 'new-hash',
          file_size: 456,
          uploaded_at: '2026-05-24T22:36:16.860037Z',
          download_url: 'https://api.jolpi.ca/data/dumps/download/delayed/?dump_type=csv',
        },
      },
    });

    expect(dump).toEqual({
      dump_type: 'csv',
      file_hash: 'new-hash',
      file_size: 456,
      uploaded_at: '2026-05-24T22:36:16.860037Z',
      download_url: 'https://api.jolpi.ca/data/dumps/download/delayed/?dump_type=csv',
    });
  });

  it('detects a new dump by hash only', () => {
    expect(hasNewDump(currentState, {
      dump_type: 'csv',
      file_hash: 'new-hash',
      file_size: 123,
      uploaded_at: currentState.uploaded_at,
      download_url: 'https://example.com/dump.zip',
    })).toBe(true);

    expect(hasNewDump(currentState, {
      dump_type: 'csv',
      file_hash: currentState.file_hash,
      file_size: 999,
      uploaded_at: '2026-06-01T00:00:00.000000Z',
      download_url: 'https://example.com/dump.zip',
    })).toBe(false);
  });

  it('fails clearly when the overview has no delayed CSV dump', () => {
    expect(() => getDelayedCsvDump({ delayed_dumps: {} })).toThrow('delayed_dumps.csv');
  });
});

describe('Jolpica fetch retries', () => {
  const noSleep = async () => {};
  const quiet = () => {};

  it('retries transient 403 responses and returns the eventual success', async () => {
    const statuses = [403, 503, 200];
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      const status = statuses.shift()!;
      return new Response(status === 200 ? '{}' : 'blocked', { status });
    }) as unknown as typeof fetch;

    const response = await fetchWithRetry('https://example.com', {}, { fetchImpl, sleep: noSleep, log: quiet });
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(3);
  });

  it('does not retry non-transient errors', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;

    const response = await fetchWithRetry('https://example.com', {}, { fetchImpl, sleep: noSleep, log: quiet });
    expect(response.status).toBe(404);
    expect(calls).toBe(1);
  });

  it('gives up after the configured attempts and surfaces the last status', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response('blocked', { status: 403 });
    }) as unknown as typeof fetch;

    await expect(fetchDelayedCsvDump('https://example.com', { attempts: 3, fetchImpl, sleep: noSleep, log: quiet }))
      .rejects.toThrow('403');
    expect(calls).toBe(3);
  });

  it('retries network errors', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      if (calls === 1) throw new TypeError('fetch failed');
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const response = await fetchWithRetry('https://example.com', {}, { fetchImpl, sleep: noSleep, log: quiet });
    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });
});

describe('Jolpica dump check resilience', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  const stateUploadedAt = (uploaded_at: string): JolpicaDumpState => ({ ...currentState, uploaded_at });

  it('identifies itself with a RaceRewind user agent', async () => {
    let headers: Headers | null = null;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({
        delayed_dumps: { csv: { dump_type: 'csv', file_hash: 'h', file_size: 1, uploaded_at: '2026-11-08T00:00:00Z' } },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    await fetchDelayedCsvDump('https://example.com', { fetchImpl });
    expect(headers!.get('user-agent')).toBe(JOLPICA_USER_AGENT);
    expect(headers!.get('user-agent')).toContain('RaceRewind');
  });

  it('reports Cloudflare details when the overview is blocked', async () => {
    const fetchImpl = (async () => new Response('<html>Attention Required! | Cloudflare</html>', {
      status: 403,
      statusText: 'Forbidden',
      headers: { server: 'cloudflare', 'cf-mitigated': 'challenge', 'cf-ray': 'abc123' },
    })) as unknown as typeof fetch;

    const error = await fetchDelayedCsvDump('https://example.com', { attempts: 1, fetchImpl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(JolpicaHttpError);
    expect((error as JolpicaHttpError).status).toBe(403);
    expect((error as Error).message).toContain('cf-mitigated=challenge');
    expect((error as Error).message).toContain('server=cloudflare');
    expect((error as Error).message).toContain('Attention Required');
  });

  it('skips a failed dump check while the stored dump is fresh', () => {
    const error = new JolpicaHttpError('blocked', 403);
    expect(canSkipFailedDumpCheck(error, stateUploadedAt('2026-11-08T23:08:14Z'), now)).toBe(true);
  });

  it('fails once the stored dump is older than the allowed age', () => {
    const error = new JolpicaHttpError('blocked', 403);
    expect(canSkipFailedDumpCheck(error, stateUploadedAt('2026-10-01T00:00:00Z'), now)).toBe(false);
    expect(dumpAgeDays(stateUploadedAt('2026-10-01T00:00:00Z'), now)).toBeGreaterThan(MAX_DUMP_AGE_DAYS);
  });

  it('never skips non-HTTP errors or a missing state', () => {
    expect(canSkipFailedDumpCheck(new Error('contract violation'), stateUploadedAt('2026-11-20T00:00:00Z'), now)).toBe(false);
    expect(canSkipFailedDumpCheck(new JolpicaHttpError('blocked', 403), null, now)).toBe(false);
  });
});
