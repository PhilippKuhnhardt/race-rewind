# Race Rewind

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
- Vercel adapter for deployment

## Setup

Requirements:

- Node.js
- [pnpm](https://pnpm.io/)

```bash
pnpm install
pnpm dev
```

The SQLite database is committed to the repository, so local development works without rebuilding the data.

## Scripts

```bash
pnpm dev           # Start the Astro dev server
pnpm build         # Build the site
pnpm preview       # Preview the production build
pnpm ingest        # Rebuild data/race-rewind.sqlite from the CSV dump
pnpm test          # Run Vitest
pnpm lint          # Run ESLint
pnpm check         # Run Astro type checks
```

## Data

Structured race data comes from the [Jolpica F1](https://github.com/jolpica/jolpica-f1) CSV export. The committed dump under `ingest/jolpica-dump/<date>/` is the source of truth for the generated SQLite database.

```bash
pnpm ingest
```

The ingestion pipeline is a full drop-and-rebuild. To update the data, add a new Jolpica CSV folder under `ingest/jolpica-dump/<date>/` and run the build script against that folder.

## Content licensing

Race context blocks under `content/race-news/` are adapted from Wikipedia and licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Each block carries visible per-entry attribution in the UI.

These files are Adapted Material under the CC BY-SA license. The rest of the project, including code, UI, and structured race data from Jolpica, is a separate independent work bundled in a Collection and is not subject to ShareAlike.

## Unofficial project

Race Rewind is an independent and unofficial project. It is not affiliated with Formula 1, the FIA, any team, constructor, driver, circuit, race promoter, or rights holder.
