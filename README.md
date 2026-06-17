# Race Rewind

Visit at [racerewind.org](https://racerewind.org).

Race Rewind is a spoiler-free Formula 1 history companion for watching old seasons race by race.

Pick a season and a race weekend to see the championship exactly as it stood at that point in time: standings, race-weekend results, team and driver context, recent form, and Wikipedia-derived historical notes. The app is built to preserve uncertainty while following a past season, so future outcomes are not shown during normal navigation and race results are kept behind an additional click.

Race Rewind does not host race footage. It provides the historical context, data, and spoiler-controlled navigation to accompany rewatches from external sources.

## Stack

- [Astro](https://astro.build/) with Svelte islands
- Tailwind CSS
- Drizzle ORM with `@libsql/client`
- SQLite database committed at `data/race-rewind.sqlite`
- TypeScript ingestion pipeline under `ingest/`
- Vitest for ingestion and utility tests

## Setup

Requirements:

- Node.js
- [pnpm](https://pnpm.io/)

```bash
pnpm install
pnpm dev
```

The SQLite database is committed to the repository, so local development works without rebuilding the data.

For production deployments, the app reads `data/race-rewind.sqlite` relative to the working directory by default. Set `RACE_REWIND_DB_PATH` to point at a different SQLite file path.

## Scripts

```bash
pnpm dev           # Start the Astro dev server
pnpm build         # Build the site
pnpm preview       # Preview the production build
pnpm ingest        # Rebuild data/race-rewind.sqlite from a configured CSV dump
pnpm jolpica:update # Download a new delayed Jolpica CSV dump when available
pnpm race-news:generate # Generate missing completed-race previews via OpenRouter
pnpm test          # Run Vitest
pnpm lint          # Run ESLint
pnpm check         # Run Astro type checks
```

## Data

Structured race data comes from the [Jolpica F1](https://github.com/jolpica/jolpica-f1) CSV export. Source CSV dumps are downloaded from Jolpica's public delayed dump endpoint and are not committed. The committed SQLite database at `data/race-rewind.sqlite` and the last-ingested dump metadata at `ingest/jolpica-dump.json` are the source of truth for the app.

```bash
pnpm jolpica:update
pnpm ingest -- --dump .tmp/jolpica-dump/csv
```

The ingestion pipeline is a full drop-and-rebuild. The nightly GitHub Actions workflow checks `https://api.jolpi.ca/data/dumps/download/`, downloads the newest delayed CSV dump only when its hash differs from `ingest/jolpica-dump.json`, rebuilds the SQLite database, generates missing completed-race preview markdown via OpenRouter, runs validation, and commits the updated database, metadata, and race-news content to `main`.

Race-news generation requires `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`. The generator only targets races with race results in the database and no existing `content/race-news/{slug}/preview.md`.

## Content licensing

Race context blocks under `content/race-news/` are adapted from Wikipedia and licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Each block carries visible per-entry attribution in the UI.

These files are Adapted Material under the CC BY-SA license. The rest of the project, including code, UI, and structured race data from Jolpica, is a separate independent work bundled in a Collection and is not subject to ShareAlike.

## Unofficial project

Race Rewind is an independent and unofficial project. It is not affiliated with Formula 1, the FIA, any team, constructor, driver, circuit, race promoter, or rights holder.
