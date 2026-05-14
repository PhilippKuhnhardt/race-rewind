"""
Post-ingest invariant checks. Run with:
    cd /path/to/f1-history
    python -m pytest ingestion/tests/ -v
"""

import pathlib
import sqlite3

import pytest

DB_PATH = pathlib.Path(__file__).parents[2] / "data" / "f1-history.sqlite"


@pytest.fixture(scope="session")
def con():
    if not DB_PATH.exists():
        pytest.skip("data/f1-history.sqlite not found — run ingestion first")
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    yield c
    c.close()


# ---------------------------------------------------------------------------
# Row-count sanity (approximate lower bounds — fail if clearly wrong)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("table,minimum", [
    ("races",                  1000),
    ("drivers",                 800),
    ("teams",                   200),
    ("circuits",                 70),
    ("seasons",                  70),
    ("round_entries",         25000),
    ("session_entries",       40000),
    ("race_results",          25000),
    ("qualifying_results",    10000),
    ("driver_standings",      20000),
    ("team_standings",         5000),
])
def test_row_count_minimum(con, table, minimum):
    n = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    assert n >= minimum, f"{table} has only {n} rows (expected >= {minimum})"


def test_no_laps_table(con):
    tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "laps" not in tables, "laps table should not exist in v1"
    assert "pit_stops" not in tables, "pit_stops table should not exist in v1"


# ---------------------------------------------------------------------------
# Foreign key integrity
# ---------------------------------------------------------------------------

def test_foreign_keys(con):
    violations = con.execute("PRAGMA foreign_key_check").fetchall()
    assert not violations, f"{len(violations)} FK violations found"


# ---------------------------------------------------------------------------
# Slug uniqueness and stability
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("table", ["races", "drivers", "teams", "circuits"])
def test_slug_unique(con, table):
    dupes = con.execute(f"SELECT slug, COUNT(*) c FROM {table} GROUP BY slug HAVING c > 1").fetchall()
    assert not dupes, f"Duplicate slugs in {table}: {[r['slug'] for r in dupes]}"


# ---------------------------------------------------------------------------
# Standings completeness
# ---------------------------------------------------------------------------

def test_race_results_have_standings(con):
    """Every driver who has a race result must have a standings snapshot for that race."""
    missing = con.execute("""
        SELECT COUNT(*) FROM race_results rr
        WHERE NOT EXISTS (
            SELECT 1 FROM driver_standings ds
            WHERE ds.race_number = rr.race_number AND ds.driver_id = rr.driver_id
        )
    """).fetchone()[0]
    # Tolerate a small number — early 1950s Indy 500 entrants may be missing
    assert missing < 100, f"{missing} race_results rows have no driver_standings"


# ---------------------------------------------------------------------------
# Spot checks against well-known historical facts
# ---------------------------------------------------------------------------

def test_schumacher_wins_to_1998_hungary(con):
    """Schumacher had 32 wins up to and including the 1998 Hungarian GP."""
    race = con.execute("SELECT race_number FROM races WHERE slug = '1998-hungarian-grand-prix'").fetchone()
    if race is None:
        pytest.skip("1998 Hungarian GP not found — check slug generation")
    driver = con.execute(
        "SELECT id FROM drivers WHERE slug LIKE 'michael-schumacher%' LIMIT 1"
    ).fetchone()
    if driver is None:
        pytest.skip("Schumacher not found")
    wins = con.execute("""
        SELECT COUNT(*) FROM race_results
        WHERE driver_id = ? AND position = 1 AND race_number <= ?
    """, (driver["id"], race["race_number"])).fetchone()[0]
    assert wins == 32, f"Expected 32 Schumacher wins, got {wins}"


def test_1986_hungarian_standings_exist(con):
    """1986 Hungarian GP was the first; it should have driver standings."""
    race = con.execute("SELECT race_number FROM races WHERE slug = '1986-hungarian-grand-prix'").fetchone()
    if race is None:
        pytest.skip("1986 Hungarian GP not found")
    n = con.execute(
        "SELECT COUNT(*) FROM driver_standings WHERE race_number = ?",
        (race["race_number"],)
    ).fetchone()[0]
    assert n > 0, "No driver standings for 1986 Hungarian GP"


def test_sprint_rounds_have_sprint_flag(con):
    """Rounds with sprint sessions must have has_sprint = 1."""
    bad = con.execute("""
        SELECT r.slug FROM races r
        WHERE r.has_sprint = 0
          AND EXISTS (
              SELECT 1 FROM sessions s WHERE s.race_number = r.race_number AND s.type = 'SR'
          )
    """).fetchall()
    assert not bad, f"Races with SR session but has_sprint=0: {[r['slug'] for r in bad]}"


def test_race_number_is_sequential(con):
    """race_number should be > 0 and cover most of 1..max without large gaps."""
    max_rn = con.execute("SELECT MAX(race_number) FROM races").fetchone()[0]
    count  = con.execute("SELECT COUNT(*) FROM races").fetchone()[0]
    # Allow for a small number of gaps (non-championship rounds etc.)
    assert count >= max_rn * 0.95, f"Too many gaps: {count} races but max race_number={max_rn}"
