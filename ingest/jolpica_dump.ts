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

export async function fetchDelayedCsvDump(overviewUrl = JOLPICA_DUMPS_OVERVIEW_URL): Promise<JolpicaDumpMetadata> {
  const response = await fetch(overviewUrl, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Failed to fetch Jolpica dumps overview: ${response.status} ${response.statusText}`);
  return getDelayedCsvDump(await response.json());
}

export async function downloadDumpZip(url: string, outputPath: string): Promise<string> {
  const response = await fetch(url);
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
