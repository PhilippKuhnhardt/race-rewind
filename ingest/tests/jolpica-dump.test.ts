import { describe, expect, it } from 'vitest';
import { fetchDelayedCsvDump, fetchWithRetry, getDelayedCsvDump, hasNewDump, type JolpicaDumpState } from '../jolpica_dump';

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
