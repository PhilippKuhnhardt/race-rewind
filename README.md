# F1 History

Time-travel F1 stats — pick any historic race and see standings, results, and championship context exactly as they were at that moment.

## Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| [pnpm](https://pnpm.io) | JS package manager (Astro) | `npm i -g pnpm` |
| [uv](https://docs.astral.sh/uv/) | Python package manager (ingestion) | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |

No other global installs needed — uv manages the Python version and virtual environment automatically.

## Setup

```bash
# Clone and install JS dependencies
pnpm install

# Create the Python virtual environment and install dev dependencies (pytest)
uv sync

# Build the SQLite database from the committed CSV dump (~1.5s)
uv run python -m ingestion.build_db \
  --dump ingestion/jolpica-dump/2026-04-02 \
  --out  data/f1-history.sqlite

# Start the Astro dev server
pnpm dev
```

The SQLite file is committed to the repo, so if you just want to run the frontend you can skip the `uv run` step.

## Ingestion

The ingestion pipeline converts the Jolpica CSV dump into `data/f1-history.sqlite`. It is a full drop-and-rebuild — safe to re-run at any time.

```bash
# Rebuild the database
uv run python -m ingestion.build_db \
  --dump ingestion/jolpica-dump/2026-04-02 \
  --out  data/f1-history.sqlite

# Run the invariant test suite
uv run pytest
```

To ingest a new dump: add the new Jolpica CSV folder under `ingestion/jolpica-dump/<date>/` and point `--dump` at it.

## Data source

Race data comes from the [Jolpica F1 API](https://api.jolpi.ca/docs/#) (Ergast successor). The raw CSV export lives in `ingestion/jolpica-dump/<date>/` and is the source of truth; `data/f1-history.sqlite` is a fully derived artifact.

DB schema docs: https://dbdocs.io/jolpica/jolpica-f1?view=relationships

## Architecture

See [architecture.md](./architecture.md) for the full design — data model, ingestion pipeline, rendering strategy, and cost breakdown.
