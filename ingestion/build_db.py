"""
Entry point: CSV dump → data/f1-history.sqlite

Usage:
    python -m ingestion.build_db \
        --dump ingestion/jolpica-dump/2026-04-02 \
        --out  data/f1-history.sqlite
"""

import argparse
import pathlib
import sqlite3
import sys
import time

from ingestion.transform import dimensions, timeline, entries, results, standings

SCHEMA = pathlib.Path(__file__).parent / "schema.sql"


def build(dump_dir: pathlib.Path, out: pathlib.Path) -> None:
    t0 = time.perf_counter()

    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()

    con = sqlite3.connect(out)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode = OFF")
    con.execute("PRAGMA synchronous = OFF")
    con.execute("PRAGMA foreign_keys = ON")

    print("Applying schema …")
    con.executescript(SCHEMA.read_text())
    con.commit()

    print("Loading reference tables …")
    dimensions.load_reference(con, dump_dir)
    con.commit()

    print("Loading dimensions (seasons, circuits, drivers, teams) …")
    state = dimensions.load_dimensions(con, dump_dir)
    con.commit()

    print("Loading timeline (races, sessions) …")
    timeline.load(con, dump_dir, state)
    con.commit()

    print("Loading entries (round_entries, session_entries) …")
    entries.load(con, dump_dir, state)
    con.commit()

    print("Building result tables (race, sprint, qualifying) …")
    results.build(con, dump_dir, state)
    con.commit()

    print("Loading standings snapshots …")
    standings.load(con, dump_dir, state)
    con.commit()

    print("Finalizing …")
    _check_integrity(con)
    con.execute("VACUUM")
    con.execute("ANALYZE")
    con.commit()
    con.close()

    elapsed = time.perf_counter() - t0
    size_mb = out.stat().st_size / 1_048_576
    print(f"\nDone in {elapsed:.1f}s — {out} ({size_mb:.1f} MB)")


def _check_integrity(con: sqlite3.Connection) -> None:
    violations = con.execute("PRAGMA foreign_key_check").fetchall()
    if violations:
        for v in violations:
            print(f"  FK violation: {v}", file=sys.stderr)
        raise SystemExit("Foreign key check failed — aborting.")

    _print_row_counts(con)

    # Sanity: every race-result driver has a standings snapshot for that race
    missing = con.execute("""
        SELECT COUNT(*) FROM race_results rr
        WHERE NOT EXISTS (
            SELECT 1 FROM driver_standings ds
            WHERE ds.race_number = rr.race_number AND ds.driver_id = rr.driver_id
        )
    """).fetchone()[0]
    if missing:
        print(f"WARNING: {missing} race_results rows have no driver_standings snapshot", file=sys.stderr)


def _print_row_counts(con: sqlite3.Connection) -> None:
    tables = [
        "drivers", "teams", "circuits", "seasons",
        "races", "sessions",
        "round_entries", "session_entries",
        "race_results", "sprint_results", "qualifying_results", "sprint_qualifying_results",
        "driver_standings", "team_standings",
    ]
    print("\nRow counts:")
    for t in tables:
        n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"  {t:<30} {n:>8,}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build f1-history.sqlite from Jolpica CSV dump")
    parser.add_argument("--dump", required=True, type=pathlib.Path, help="Directory containing Jolpica CSV files")
    parser.add_argument("--out", required=True, type=pathlib.Path, help="Output SQLite path")
    args = parser.parse_args()

    if not args.dump.is_dir():
        sys.exit(f"Dump directory not found: {args.dump}")

    build(args.dump, args.out)
