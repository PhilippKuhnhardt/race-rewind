"""Load races and sessions."""

import pathlib
import sqlite3

from ingestion.transform import IngestState
from ingestion.transform.slugs import deduplicate, race_slug
from ingestion.transform.util import as_bool, as_int, read_csv


def load(con: sqlite3.Connection, dump_dir: pathlib.Path, state: IngestState) -> None:
    season_map  = state.seasons   # jolpica_id → year
    circuit_map = state.circuits  # jolpica_id → internal_id

    # --- sessions: index by round_id so we can compute races.date and has_sprint ---
    sessions_by_round: dict[str, list[dict]] = {}
    for r in read_csv(dump_dir, "formula_one_session.csv"):
        rid = r["round_id"]
        if not rid:
            continue
        sessions_by_round.setdefault(rid, []).append(r)

    # --- races ---
    existing_slugs: set[str] = set()
    race_rows = []
    for r in read_csv(dump_dir, "formula_one_round.csv"):
        if not r.get("race_number"):
            continue  # cancelled round — excluded from timeline
        jolpica_round_id = r["id"]
        year = season_map[int(r["season_id"])]

        base = race_slug(year, r["name"])
        slug = deduplicate(base, existing_slugs)
        existing_slugs.add(slug)

        sessions = sessions_by_round.get(jolpica_round_id, [])
        # Use race session timestamp for the date; fall back to round.date
        race_session = next((s for s in sessions if s["type"] == "R"), None)
        if race_session and race_session.get("timestamp"):
            date = race_session["timestamp"][:10]
        else:
            date = r["date"]

        has_sprint = int(any(s["type"] == "SR" for s in sessions))

        race_rows.append((
            int(r["race_number"]),
            slug,
            int(r["id"]),
            r["api_id"],
            year,
            as_int(r, "number"),
            circuit_map[int(r["circuit_id"])],
            r["name"],
            date,
            has_sprint,
            r.get("wikipedia") or None,
        ))

    con.executemany("""
        INSERT INTO races
          (race_number, slug, jolpica_id, jolpica_api_id,
           season, round, circuit_id, name, date, has_sprint, wikipedia)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, race_rows)

    # Build race_number lookup for sessions phase
    race_number_by_jolpica_round: dict[str, int] = {
        str(r[2]): r[0] for r in race_rows  # jolpica_id (index 2) → race_number (index 0)
    }

    # --- sessions ---
    session_rows = []
    for rid, sess_list in sessions_by_round.items():
        race_number = race_number_by_jolpica_round.get(rid)
        if race_number is None:
            continue  # belongs to a cancelled round
        for s in sess_list:
            session_rows.append((
                int(s["id"]),
                s["api_id"],
                race_number,
                s["type"],
                as_int(s, "number"),
                as_int(s, "point_system_id"),
                as_int(s, "scheduled_laps"),
                s.get("timestamp") or None,
                s.get("timezone") or None,
                as_bool(s, "has_time_data"),
                as_bool(s, "is_cancelled"),
            ))

    con.executemany("""
        INSERT INTO sessions
          (jolpica_id, jolpica_api_id, race_number, type, number,
           point_system_id, scheduled_laps, timestamp, timezone,
           has_time_data, is_cancelled)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, session_rows)

    # Expose for downstream modules
    state.race_number_by_round_jolpica_id = race_number_by_jolpica_round
