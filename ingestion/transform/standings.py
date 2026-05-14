"""
Load driver_standings and team_standings from Jolpica championship snapshot CSVs.

Deduplication: each (round_id, driver_id) can appear multiple times in
formula_one_driverchampionship.csv — once per session within that round.
We keep only the row with the highest session_number (post-final-session).
"""

import pathlib
import sqlite3

from ingestion.transform import IngestState
from ingestion.transform.util import as_bool, as_float, as_int, read_csv


def load(con: sqlite3.Connection, dump_dir: pathlib.Path, state: IngestState) -> None:
    driver_map = state.drivers  # jolpica_id → internal_id
    team_map   = state.teams
    season_map = state.seasons  # jolpica season_id → year

    # race_number lookup: jolpica round_id → race_number
    rn_by_round = {
        row["jolpica_id"]: row["race_number"]
        for row in con.execute("SELECT race_number, jolpica_id FROM races")
    }

    _load_driver_standings(con, dump_dir, driver_map, rn_by_round)
    _load_team_standings(con, dump_dir, team_map, rn_by_round)
    _load_championship_adjustments(con, dump_dir, driver_map, team_map, season_map)


def _load_driver_standings(
    con: sqlite3.Connection,
    dump_dir: pathlib.Path,
    driver_map: dict,
    rn_by_round: dict,
) -> None:
    # Deduplicate: keep highest session_number per (round_id, driver_id)
    best: dict[tuple, dict] = {}
    for r in read_csv(dump_dir, "formula_one_driverchampionship.csv"):
        if not r.get("round_id"):
            continue
        key = (r["round_id"], r["driver_id"])
        snum = as_int(r, "session_number") or 0
        if key not in best or snum > (as_int(best[key], "session_number") or 0):
            best[key] = r

    records = []
    for (round_id, jdriver_id), r in best.items():
        race_number = rn_by_round.get(int(round_id))
        driver_id   = driver_map.get(int(jdriver_id))
        if race_number is None or driver_id is None:
            continue
        records.append((
            race_number,
            driver_id,
            as_int(r, "position"),
            as_float(r, "points") or 0.0,
            as_int(r, "win_count") or 0,
            as_int(r, "highest_finish"),
            as_bool(r, "is_eligible"),
            as_int(r, "adjustment_type") or 0,
        ))

    BATCH = 5_000
    for i in range(0, len(records), BATCH):
        con.executemany("""
            INSERT INTO driver_standings
              (race_number, driver_id, position, points, win_count,
               highest_finish, is_eligible, adjustment_type)
            VALUES (?,?,?,?,?,?,?,?)
        """, records[i:i + BATCH])


def _load_team_standings(
    con: sqlite3.Connection,
    dump_dir: pathlib.Path,
    team_map: dict,
    rn_by_round: dict,
) -> None:
    best: dict[tuple, dict] = {}
    for r in read_csv(dump_dir, "formula_one_teamchampionship.csv"):
        if not r.get("round_id"):
            continue
        key = (r["round_id"], r["team_id"])
        snum = as_int(r, "session_number") or 0
        if key not in best or snum > (as_int(best[key], "session_number") or 0):
            best[key] = r

    records = []
    for (round_id, jteam_id), r in best.items():
        race_number = rn_by_round.get(int(round_id))
        team_id     = team_map.get(int(jteam_id))
        if race_number is None or team_id is None:
            continue
        records.append((
            race_number,
            team_id,
            as_int(r, "position"),
            as_float(r, "points") or 0.0,
            as_int(r, "win_count") or 0,
            as_int(r, "highest_finish"),
            as_bool(r, "is_eligible"),
            as_int(r, "adjustment_type") or 0,
        ))

    BATCH = 5_000
    for i in range(0, len(records), BATCH):
        con.executemany("""
            INSERT INTO team_standings
              (race_number, team_id, position, points, win_count,
               highest_finish, is_eligible, adjustment_type)
            VALUES (?,?,?,?,?,?,?,?)
        """, records[i:i + BATCH])


def _load_championship_adjustments(
    con: sqlite3.Connection,
    dump_dir: pathlib.Path,
    driver_map: dict,
    team_map: dict,
    season_map: dict | None = None,
) -> None:
    rows = read_csv(dump_dir, "formula_one_championshipadjustment.csv")
    if not rows:
        return
    records = []
    for r in rows:
        year = season_map.get(int(r["season_id"])) if r.get("season_id") else None
        records.append((
            int(r["id"]),
            r["api_id"],
            as_int(r, "adjustment"),
            as_float(r, "points"),
            driver_map.get(int(r["driver_id"])) if r.get("driver_id") else None,
            team_map.get(int(r["team_id"])) if r.get("team_id") else None,
            year,
        ))
    con.executemany("""
        INSERT INTO championship_adjustments
          (id, jolpica_api_id, adjustment, points, driver_id, team_id, season_id)
        VALUES (?,?,?,?,?,?,?)
    """, records)
