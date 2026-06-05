import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import path from 'node:path';
import * as schema from './schema';
import * as relations from './relations';

const client = createClient({
  url: `file:${path.resolve(process.cwd(), 'data/race-rewind.sqlite')}`,
});

export const db = drizzle(client, { schema: { ...schema, ...relations } });
