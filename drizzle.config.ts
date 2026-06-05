import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'turso',
  dbCredentials: { url: 'file:data/race-rewind.sqlite' },
  schema: 'src/db/schema.ts',
});
