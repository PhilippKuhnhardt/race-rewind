"""Load round_entries and session_entries."""

import pathlib
import sqlite3

from ingestion.transform import IngestState
from ingestion.transform.util import as_bool, as_float, as_int, read_csv


def load(con: sqlite3.Connection, dump_dir: pathlib.Path, state: IngestState) -> None:
    driver_map   = state.drivers   # jolpica_id → internal_id
    team_map     = state.teams
    race_number_by_round = state.race_number_by_round_jolpica_id  # jolpica round id → race_number

    # teamdriver: jolpica_id → {driver_id, team_id}
    td_map: dict[str, dict] = {}
    for r in read_csv(dump_dir, "formula_one_teamdriver.csv"):
        td_map[r["id"]] = {
            "driver_id": driver_map[int(r["driver_id"])],
            "team_id":   team_map[int(r["team_id"])],
        }

    # --- round_entries ---
    re_rows = []
    for r in read_csv(dump_dir, "formula_one_roundentry.csv"):
        race_number = race_number_by_round.get(r["round_id"])
        if race_number is None:
            continue  # cancelled round
        td = td_map.get(r["team_driver_id"])
        if td is None:
            continue  # defensive: should not happen
        re_rows.append((
            int(r["id"]),
            r["api_id"],
            race_number,
            td["driver_id"],
            td["team_id"],
            as_int(r, "car_number"),
        ))

    # All rows inserted — duplicates (shared drives / multi-car entries) are preserved
    # so their session_entries references remain valid. The race_results builder
    # deduplicates to the better result per (race_number, driver_id).
    con.executemany("""
        INSERT INTO round_entries
          (jolpica_id, jolpica_api_id, race_number, driver_id, team_id, car_number)
        VALUES (?,?,?,?,?,?)
    """, re_rows)

    # Build round_entry jolpica_id → internal_id map
    re_internal_map = {
        row["jolpica_id"]: row["id"]
        for row in con.execute("SELECT id, jolpica_id FROM round_entries")
    }

    # session jolpica_id → internal_id
    session_internal_map = {
        row["jolpica_id"]: row["id"]
        for row in con.execute("SELECT id, jolpica_id FROM sessions")
    }

    # --- session_entries ---
    se_rows = []
    for r in read_csv(dump_dir, "formula_one_sessionentry.csv"):
        session_id     = session_internal_map.get(int(r["session_id"]))
        round_entry_id = re_internal_map.get(int(r["round_entry_id"]))
        if session_id is None or round_entry_id is None:
            continue  # session or entry belongs to a cancelled round
        se_rows.append((
            int(r["id"]),
            r["api_id"],
            session_id,
            round_entry_id,
            as_int(r, "grid"),
            as_int(r, "position"),
            as_int(r, "laps_completed"),
            as_int(r, "status"),
            r.get("detail") or None,
            r.get("time") or None,
            as_float(r, "points"),
            as_bool(r, "is_classified"),
            as_bool(r, "is_eligible_for_points"),
            as_int(r, "fastest_lap_rank"),
        ))

    BATCH = 10_000
    for i in range(0, len(se_rows), BATCH):
        con.executemany("""
            INSERT INTO session_entries
              (jolpica_id, jolpica_api_id, session_id, round_entry_id,
               grid, position, laps_completed, status, detail, time,
               points, is_classified, is_eligible_for_points, fastest_lap_rank)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, se_rows[i:i + BATCH])

    # Expose for results/standings modules
    state.re_internal_map      = re_internal_map
    state.session_internal_map = session_internal_map
