import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

type SqlParam = null | number | bigint | string | Uint8Array;

const dbPath = path.resolve(process.cwd(), 'data/f1-history.sqlite');
export const db = new DatabaseSync(dbPath, { open: true });
db.exec('PRAGMA foreign_keys = ON');

export function queryAll<T>(sql: string, ...params: SqlParam[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

export function queryOne<T>(sql: string, ...params: SqlParam[]): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}
