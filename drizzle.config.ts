import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'turso',
  dbCredentials: { url: 'file:data/f1-history.sqlite' },
  schema: 'src/db/schema.ts',
});
