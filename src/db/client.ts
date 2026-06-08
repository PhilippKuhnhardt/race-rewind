import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import path from 'node:path';
import * as schema from './schema';
import * as relations from './relations';

const DB_RELATIVE_PATH = 'data/race-rewind.sqlite';

const client = createClient({
  url: `file:${path.resolve(process.cwd(), DB_RELATIVE_PATH)}`,
});

export const db = drizzle(client, { schema: { ...schema, ...relations } });
