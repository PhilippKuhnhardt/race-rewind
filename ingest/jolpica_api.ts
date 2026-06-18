export const JOLPICA_API_BASE_URL = 'https://api.jolpi.ca';

export type JolpicaFetchOptions = {
  baseUrl?: string;
  requestBudget?: number;
  minDelayMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export class JolpicaRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JolpicaRateLimitError';
  }
}

export class JolpicaRequestBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JolpicaRequestBudgetError';
  }
}

export class JolpicaClient {
  private readonly baseUrl: string;
  private readonly requestBudget: number;
  private readonly minDelayMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastRequestAt = 0;
  private used = 0;
  rateLimited = false;

  constructor(options: JolpicaFetchOptions = {}) {
    this.baseUrl = options.baseUrl ?? JOLPICA_API_BASE_URL;
    this.requestBudget = options.requestBudget ?? 250;
    this.minDelayMs = options.minDelayMs ?? 500;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
  }

  get requestsUsed() {
    return this.used;
  }

  async getJson<T>(path: string): Promise<T> {
    if (this.used >= this.requestBudget) {
      throw new JolpicaRequestBudgetError(`Jolpica API request budget exhausted (${this.requestBudget})`);
    }

    const elapsed = this.now() - this.lastRequestAt;
    if (this.lastRequestAt > 0 && elapsed < this.minDelayMs) {
      await this.sleep(this.minDelayMs - elapsed);
    }

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    this.used += 1;
    this.lastRequestAt = this.now();
    const response = await this.fetchImpl(url, { headers: { accept: 'application/json' } });

    if (response.status === 429) {
      this.rateLimited = true;
      const retryAfter = response.headers.get('retry-after');
      throw new JolpicaRateLimitError(
        retryAfter
          ? `Jolpica API rate-limited request; retry after ${retryAfter}`
          : 'Jolpica API rate-limited request',
      );
    }

    if (!response.ok) {
      throw new Error(`Jolpica API request failed: ${response.status} ${response.statusText} (${url})`);
    }

    return await response.json() as T;
  }
}

export function deterministicNegativeId(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return -((hash >>> 0) % 2_000_000_000 + 1);
}
