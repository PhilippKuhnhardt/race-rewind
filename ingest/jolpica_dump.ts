import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { JOLPICA_HEADERS, JOLPICA_USER_AGENT } from './jolpica_api';

export const JOLPICA_DUMPS_OVERVIEW_URL = 'https://api.jolpi.ca/data/dumps/download/';
export const JOLPICA_DELAYED_CSV_DOWNLOAD_URL = 'https://api.jolpi.ca/data/dumps/download/delayed/?dump_type=csv';

export type JolpicaDumpMetadata = {
  dump_type: 'csv';
  file_hash: string;
  file_size: number;
  uploaded_at: string;
  download_url: string;
};

export type JolpicaDumpState = {
  dump_type: 'csv';
  file_hash: string;
  file_size: number | null;
  uploaded_at: string;
  source: string;
};

type DumpsOverview = {
  delayed_dumps?: {
    csv?: Partial<JolpicaDumpMetadata>;
  };
};

export function readDumpState(metadataPath: string): JolpicaDumpState | null {
  if (!existsSync(metadataPath)) return null;
  return JSON.parse(readFileSync(metadataPath, 'utf8')) as JolpicaDumpState;
}

export function getDelayedCsvDump(overview: unknown): JolpicaDumpMetadata {
  const csv = (overview as DumpsOverview).delayed_dumps?.csv;
  if (!csv) throw new Error('Jolpica dumps overview did not include delayed_dumps.csv');
  if (csv.dump_type !== 'csv') throw new Error(`Expected delayed CSV dump, got ${String(csv.dump_type)}`);
  if (!csv.file_hash) throw new Error('Jolpica delayed CSV dump did not include file_hash');
  if (typeof csv.file_size !== 'number') throw new Error('Jolpica delayed CSV dump did not include numeric file_size');
  if (!csv.uploaded_at) throw new Error('Jolpica delayed CSV dump did not include uploaded_at');

  return {
    dump_type: 'csv',
    file_hash: csv.file_hash,
    file_size: csv.file_size,
    uploaded_at: csv.uploaded_at,
    download_url: csv.download_url ?? JOLPICA_DELAYED_CSV_DOWNLOAD_URL,
  };
}

// Delayed dumps are published with a 14 day delay, roughly weekly. If our stored dump is
// much older than that, the dump check has been failing for too long to keep tolerating it.
export const MAX_DUMP_AGE_DAYS = 30;

export function dumpAgeDays(state: JolpicaDumpState | null, now = Date.now()): number | null {
  if (!state?.uploaded_at) return null;
  const uploaded = Date.parse(state.uploaded_at);
  if (Number.isNaN(uploaded)) return null;
  return (now - uploaded) / 86_400_000;
}

// The dumps endpoint is regularly unavailable (e.g. Cloudflare blocks). Dumps are delayed by
// two weeks anyway, so an HTTP failure can be skipped while the stored dump is still fresh.
export function canSkipFailedDumpCheck(error: unknown, current: JolpicaDumpState | null, now = Date.now()): boolean {
  const age = dumpAgeDays(current, now);
  return error instanceof JolpicaHttpError && age !== null && age <= MAX_DUMP_AGE_DAYS;
}

export function hasNewDump(current: JolpicaDumpState | null, next: JolpicaDumpMetadata): boolean {
  return current?.file_hash !== next.file_hash;
}

export function writeDumpState(metadataPath: string, dump: JolpicaDumpMetadata) {
  const state: JolpicaDumpState = {
    dump_type: dump.dump_type,
    file_hash: dump.file_hash,
    file_size: dump.file_size,
    uploaded_at: dump.uploaded_at,
    source: 'https://api.jolpi.ca/data/dumps/download/',
  };
  writeFileSync(metadataPath, `${JSON.stringify(state, null, 2)}\n`);
}

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
};

// Jolpica sits behind Cloudflare and occasionally answers with transient 403/429/5xx
// responses. These are retried with exponential backoff before the job fails.
const RETRYABLE_STATUSES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

export async function fetchWithRetry(url: string, init: RequestInit = {}, options: RetryOptions = {}): Promise<Response> {
  const attempts = options.attempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 5_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const log = options.log ?? ((message: string) => console.warn(message));

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let response: Response | null = null;
    try {
      response = await fetchImpl(url, init);
    } catch (error) {
      lastError = error;
    }

    if (response && (response.ok || !isRetryableStatus(response.status))) return response;
    if (attempt === attempts) {
      if (response) return response;
      break;
    }

    const delay = baseDelayMs * 2 ** (attempt - 1);
    const reason = response ? `${response.status} ${response.statusText}` : String(lastError);
    log(`Request to ${url} failed (${reason}); retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${attempts})`);
    await sleep(delay);
  }

  throw lastError instanceof Error ? lastError : new Error(`Request to ${url} failed`);
}

export class JolpicaHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'JolpicaHttpError';
  }
}

// Collects the bits of a failed response that tell a Cloudflare block apart from an API error.
export async function describeFailedResponse(response: Response): Promise<string> {
  const parts = [`${response.status} ${response.statusText}`.trim()];
  for (const header of ['server', 'cf-mitigated', 'cf-ray']) {
    const value = response.headers.get(header);
    if (value) parts.push(`${header}=${value}`);
  }
  try {
    const body = (await response.text()).replace(/\s+/g, ' ').trim();
    if (body) parts.push(`body: ${body.slice(0, 200)}`);
  } catch {
    // Body is only diagnostic.
  }
  return parts.join(', ');
}

export async function fetchDelayedCsvDump(
  overviewUrl = JOLPICA_DUMPS_OVERVIEW_URL,
  retry: RetryOptions = {},
): Promise<JolpicaDumpMetadata> {
  const response = await fetchWithRetry(overviewUrl, { headers: JOLPICA_HEADERS }, retry);
  if (!response.ok) {
    throw new JolpicaHttpError(`Failed to fetch Jolpica dumps overview: ${await describeFailedResponse(response)}`, response.status);
  }
  return getDelayedCsvDump(await response.json());
}

export async function downloadDumpZip(url: string, outputPath: string, retry: RetryOptions = {}): Promise<string> {
  const response = await fetchWithRetry(url, { headers: { 'user-agent': JOLPICA_USER_AGENT } }, retry);
  if (!response.ok) {
    throw new JolpicaHttpError(`Failed to download Jolpica dump: ${await describeFailedResponse(response)}`, response.status);
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  return sha256File(outputPath);
}

export function sha256File(filePath: string): string {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

export function prepareDirectory(dir: string) {
  const resolved = path.resolve(dir);
  if (resolved === path.parse(resolved).root) throw new Error(`Refusing to prepare root directory: ${resolved}`);
  if (resolved === process.cwd()) throw new Error(`Refusing to prepare repository root: ${resolved}`);
  if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
}
