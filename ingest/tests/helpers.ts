import { existsSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../../src/db/schema';

const DB_PATH = path.resolve('data/race-rewind.sqlite');

export function skipIfNoDb() {
  if (!existsSync(DB_PATH)) return 'data/race-rewind.sqlite not found - run pnpm ingest first';
  return null;
}

export function openDb() {
  const client = createClient({ url: `file:${DB_PATH}` });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type DbHandle = ReturnType<typeof openDb>;
