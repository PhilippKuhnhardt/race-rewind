import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';
import * as relations from './relations';

const DB_RELATIVE_PATH = 'data/race-rewind.sqlite';
const TMP_DB_PATH = '/tmp/race-rewind.sqlite';

function getDatabasePath(): string {
  const bundledPath = path.resolve(process.cwd(), DB_RELATIVE_PATH);

  if (!process.env.VERCEL) return bundledPath;

  const bundledStat = fs.statSync(bundledPath);
  const tmpStat = fs.existsSync(TMP_DB_PATH) ? fs.statSync(TMP_DB_PATH) : null;

  if (!tmpStat || tmpStat.size !== bundledStat.size || tmpStat.mtimeMs < bundledStat.mtimeMs) {
    fs.copyFileSync(bundledPath, TMP_DB_PATH);
  }

  return TMP_DB_PATH;
}

const client = createClient({
  url: `file:${getDatabasePath()}`,
});

export const db = drizzle(client, { schema: { ...schema, ...relations } });
