import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import path from 'node:path';
import * as schema from './schema';
import * as relations from './relations';

const DEFAULT_DB_PATH = 'data/race-rewind.sqlite';

function getDatabaseUrl(): string {
  const configuredPath = process.env.RACE_REWIND_DB_PATH?.trim();
  const databasePath = path.resolve(process.cwd(), configuredPath || DEFAULT_DB_PATH);
  return `file:${databasePath}`;
}

const client = createClient({
  url: getDatabaseUrl(),
});

export const db = drizzle(client, { schema: { ...schema, ...relations } });
