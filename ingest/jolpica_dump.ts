import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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

export async function fetchDelayedCsvDump(
  overviewUrl = JOLPICA_DUMPS_OVERVIEW_URL,
  retry: RetryOptions = {},
): Promise<JolpicaDumpMetadata> {
  const response = await fetchWithRetry(overviewUrl, { headers: { accept: 'application/json' } }, retry);
  if (!response.ok) throw new Error(`Failed to fetch Jolpica dumps overview: ${response.status} ${response.statusText}`);
  return getDelayedCsvDump(await response.json());
}

export async function downloadDumpZip(url: string, outputPath: string, retry: RetryOptions = {}): Promise<string> {
  const response = await fetchWithRetry(url, {}, retry);
  if (!response.ok) throw new Error(`Failed to download Jolpica dump: ${response.status} ${response.statusText}`);

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
