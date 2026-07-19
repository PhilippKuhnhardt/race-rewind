import { describe, expect, it } from 'vitest';
import { deterministicNegativeId, JolpicaClient, JolpicaRateLimitError, JolpicaRequestBudgetError } from '../jolpica_api';
import { hasResultRows, normalizeLapTime, normalizeRaceTime } from '../backfill_jolpica_api';

describe('Jolpica API rate-limited client', () => {
  it('enforces the per-run request budget', async () => {
    const client = new JolpicaClient({
      requestBudget: 1,
      minDelayMs: 0,
      fetchImpl: async () => Response.json({ ok: true }),
    });

    await expect(client.getJson('/first')).resolves.toEqual({ ok: true });
    await expect(client.getJson('/second')).rejects.toBeInstanceOf(JolpicaRequestBudgetError);
    expect(client.requestsUsed).toBe(1);
  });

  it('paces serial requests', async () => {
    let now = 1_000;
    const sleeps: number[] = [];
    const client = new JolpicaClient({
      requestBudget: 2,
      minDelayMs: 500,
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
      fetchImpl: async () => Response.json({ ok: true }),
    });

    await client.getJson('/first');
    now += 100;
    await client.getJson('/second');

    expect(sleeps).toEqual([400]);
    expect(client.requestsUsed).toBe(2);
  });

  it('marks 429 responses as rate limited', async () => {
    const client = new JolpicaClient({
      requestBudget: 1,
      minDelayMs: 0,
      fetchImpl: async () => new Response('{}', { status: 429 }),
    });

    await expect(client.getJson('/limited')).rejects.toBeInstanceOf(JolpicaRateLimitError);
    expect(client.rateLimited).toBe(true);
  });
});

describe('Jolpica backfill helpers', () => {
  it('creates deterministic negative IDs from string API IDs', () => {
    expect(deterministicNegativeId('sessionentry_SCbVpS7U')).toBeLessThan(0);
    expect(deterministicNegativeId('sessionentry_SCbVpS7U')).toBe(deterministicNegativeId('sessionentry_SCbVpS7U'));
    expect(deterministicNegativeId('sessionentry_SCbVpS7U')).not.toBe(deterministicNegativeId('sessionentry_3E2RMkmE'));
  });

  it('normalizes Jolpica display times into existing DB time shape', () => {
    expect(normalizeLapTime('1:12.051')).toBe('00:01:12.051');
    expect(normalizeRaceTime('2:23:31.243')).toBe('02:23:31.243');
    expect(normalizeRaceTime('56:36.709')).toBe('00:56:36.709');
  });

  it('does not treat empty result payloads as database changes', () => {
    expect(hasResultRows({ data: { results: [] } })).toBe(false);
    expect(hasResultRows({ data: { results: [{}] } })).toBe(true);
  });
});
