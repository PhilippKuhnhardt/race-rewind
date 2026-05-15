import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';

export function readCsv(dumpDir: string, name: string): Record<string, string>[] {
  const buf = readFileSync(`${dumpDir}/${name}`);
  return parse(buf, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
}

export function asInt(row: Record<string, string>, key: string): number | null {
  const v = row[key];
  return v ? parseInt(v, 10) : null;
}

export function asFloat(row: Record<string, string>, key: string): number | null {
  const v = row[key];
  return v ? parseFloat(v) : null;
}

export function asBool(row: Record<string, string>, key: string): number {
  return row[key] === 't' ? 1 : 0;
}
