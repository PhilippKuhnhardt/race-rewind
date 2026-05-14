"""
Build denormalised result tables from session_entries:
  race_results, sprint_results, qualifying_results, sprint_qualifying_results.

Also aggregates pit_stop_count from formula_one_pitstop.csv.
"""

import pathlib
import sqlite3
from collections import defaultdict

from ingestion.transform import IngestState
from ingestion.transform.util import read_csv


def build(con: sqlite3.Connection, dump_dir: pathlib.Path, state: IngestState) -> None:
    pit_counts = _count_pit_stops(dump_dir)
    q_lap_times = _load_qualifying_lap_times(dump_dir)

    _build_race_and_sprint_results(con, pit_counts)
    _build_qualifying_results(con, q_lap_times)
    _build_sprint_qualifying_results(con, q_lap_times)


def _load_qualifying_lap_times(dump_dir: pathlib.Path) -> dict[str, str]:
    """
    Returns {session_entry_jolpica_id: lap_time} for is_entry_fastest_lap='t' rows.
    Qualifying session_entries have no time in the session_entries table; the actual
    Q1/Q2/Q3 lap times live here as the driver's single fastest lap per session.
    """
    times: dict[str, str] = {}
    for r in read_csv(dump_dir, "formula_one_lap.csv"):
        if r["is_entry_fastest_lap"] == "t" and r.get("time"):
            times[r["session_entry_id"]] = r["time"]
    return times


def _count_pit_stops(dump_dir: pathlib.Path) -> dict[str, int]:
    """Returns {session_entry_jolpica_id: count}."""
    counts: dict[str, int] = defaultdict(int)
    for r in read_csv(dump_dir, "formula_one_pitstop.csv"):
        if r.get("session_entry_id"):
            counts[r["session_entry_id"]] += 1
    return counts


def _better(a: dict, b: dict) -> dict:
    """Return whichever row represents the better race result."""
    a_pos = a["position"]
    b_pos = b["position"]
    if a_pos is not None and b_pos is not None:
        return a if a_pos < b_pos else b
    if a_pos is not None:
        return a
    if b_pos is not None:
        return b
    a_laps = a["laps_completed"] or 0
    b_laps = b["laps_completed"] or 0
    if a_laps != b_laps:
        return a if a_laps > b_laps else b
    return a if a["se_id"] < b["se_id"] else b


def _build_race_and_sprint_results(
    con: sqlite3.Connection,
    pit_counts: dict[str, int],
) -> None:
    rows = con.execute("""
        SELECT se.id          AS se_id,
               se.jolpica_id  AS se_jolpica_id,
               s.type         AS session_type,
               re.race_number,
               re.driver_id,
               re.team_id,
               re.car_number,
               se.grid,
               se.position,
               se.laps_completed,
               se.status,
               se.detail,
               se.time,
               se.points,
               se.is_classified,
               se.fastest_lap_rank
        FROM session_entries se
        JOIN sessions      s  ON s.id  = se.session_id
        JOIN round_entries re ON re.id = se.round_entry_id
        WHERE s.type IN ('R', 'SR')
    """).fetchall()

    # Bucket by (race_number, driver_id, session_type); keep best result per bucket
    best: dict[tuple, dict] = {}
    for row in rows:
        key = (row["race_number"], row["driver_id"], row["session_type"])
        candidate = dict(row)
        if key in best:
            candidate = _better(best[key], candidate)
        best[key] = candidate

    race_records = []
    sprint_records = []
    for (race_number, driver_id, stype), r in best.items():
        record = (
            race_number,
            driver_id,
            r["team_id"],
            r["car_number"],
            r["grid"],
            r["position"],
            r["status"],
            r["detail"],
            r["time"],
            r["laps_completed"],
            r["points"],
            r["is_classified"],
            r["fastest_lap_rank"],
            pit_counts.get(str(r["se_jolpica_id"]), 0),
        )
        if stype == "R":
            race_records.append(record)
        else:
            sprint_records.append(record)

    insert_sql = """
        INSERT INTO {table}
          (race_number, driver_id, team_id, car_number,
           grid, position, status, detail, time,
           laps_completed, points, is_classified,
           fastest_lap_rank, pit_stop_count)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """
    if race_records:
        con.executemany(insert_sql.format(table="race_results"), race_records)
    if sprint_records:
        con.executemany(insert_sql.format(table="sprint_results"), sprint_records)


def _build_qualifying_results(
    con: sqlite3.Connection,
    lap_times: dict[str, str],
) -> None:
    """
    Pivot Q-session entries into one row per (race, driver).
    Modern era (Q1/Q2/Q3), single-session eras (QB/QO/QA).
    Times come from lap_times (is_entry_fastest_lap rows), not session_entries.time.
    """
    q_entries = con.execute("""
        SELECT se.id, se.jolpica_id, se.position,
               s.type AS session_type,
               re.race_number, re.driver_id, re.team_id
        FROM session_entries se
        JOIN sessions s ON s.id = se.session_id
        JOIN round_entries re ON re.id = se.round_entry_id
        WHERE s.type IN ('Q1','Q2','Q3','QB','QO','QA')
        ORDER BY re.race_number, re.driver_id, s.type
    """).fetchall()

    by_driver: dict[tuple, list] = defaultdict(list)
    for row in q_entries:
        by_driver[(row["race_number"], row["driver_id"])].append(row)

    records = []
    for (race_number, driver_id), entries in by_driver.items():
        team_id = entries[0]["team_id"]
        types = {e["session_type"] for e in entries}

        if types & {"Q1", "Q2", "Q3"}:
            times = {e["session_type"]: lap_times.get(str(e["jolpica_id"])) for e in entries}
            by_type = {e["session_type"]: e for e in entries}
            if "Q3" in by_type:
                position = by_type["Q3"]["position"]
                knocked_out = None
            elif "Q2" in by_type:
                position = by_type["Q2"]["position"]
                knocked_out = "Q2"
            else:
                position = by_type["Q1"]["position"]
                knocked_out = "Q1"
            records.append((
                race_number, driver_id, team_id, position,
                times.get("Q1"), times.get("Q2"), times.get("Q3"),
                None, knocked_out,
            ))
        else:
            by_type = {e["session_type"]: e for e in entries}
            valid_times = [lap_times.get(str(e["jolpica_id"])) for e in entries
                           if lap_times.get(str(e["jolpica_id"]))]
            best_time = min(valid_times) if valid_times else None
            position = None
            for stype in ("QA", "QO", "QB"):
                if stype in by_type and by_type[stype]["position"]:
                    position = by_type[stype]["position"]
                    break
            if position is None:
                position = min((e["position"] for e in entries if e["position"]), default=None)
            records.append((
                race_number, driver_id, team_id, position,
                None, None, None, best_time, None,
            ))

    con.executemany("""
        INSERT INTO qualifying_results
          (race_number, driver_id, team_id, position,
           q1_time, q2_time, q3_time, qualifying_time, knocked_out_in)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, records)


def _build_sprint_qualifying_results(
    con: sqlite3.Connection,
    lap_times: dict[str, str],
) -> None:
    sq_entries = con.execute("""
        SELECT se.id, se.jolpica_id, se.position,
               s.type AS session_type,
               re.race_number, re.driver_id, re.team_id
        FROM session_entries se
        JOIN sessions s ON s.id = se.session_id
        JOIN round_entries re ON re.id = se.round_entry_id
        WHERE s.type IN ('SQ1','SQ2','SQ3')
        ORDER BY re.race_number, re.driver_id, s.type
    """).fetchall()

    by_driver: dict[tuple, list] = defaultdict(list)
    for row in sq_entries:
        by_driver[(row["race_number"], row["driver_id"])].append(row)

    records = []
    for (race_number, driver_id), entries in by_driver.items():
        team_id = entries[0]["team_id"]
        times = {e["session_type"]: lap_times.get(str(e["jolpica_id"])) for e in entries}
        by_type = {e["session_type"]: e for e in entries}
        if "SQ3" in by_type:
            position = by_type["SQ3"]["position"]
            knocked_out = None
        elif "SQ2" in by_type:
            position = by_type["SQ2"]["position"]
            knocked_out = "SQ2"
        else:
            position = by_type["SQ1"]["position"]
            knocked_out = "SQ1"
        records.append((
            race_number, driver_id, team_id, position,
            times.get("SQ1"), times.get("SQ2"), times.get("SQ3"),
            knocked_out,
        ))

    con.executemany("""
        INSERT INTO sprint_qualifying_results
          (race_number, driver_id, team_id, position,
           sq1_time, sq2_time, sq3_time, knocked_out_in)
        VALUES (?,?,?,?,?,?,?,?)
    """, records)
