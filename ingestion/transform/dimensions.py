"""Load reference and dimension tables; return IngestState with jolpica_id → internal_id maps."""

import pathlib
import sqlite3

from ingestion.transform import IngestState
from ingestion.transform.slugs import deduplicate, driver_slug, slugify
from ingestion.transform.util import as_bool, as_float, as_int, read_csv


def load_reference(con: sqlite3.Connection, dump_dir: pathlib.Path) -> None:
    _load_championship_systems(con, dump_dir)
    _load_point_systems(con, dump_dir)
    _load_base_teams(con, dump_dir)


def load_dimensions(con: sqlite3.Connection, dump_dir: pathlib.Path) -> IngestState:
    return IngestState(
        seasons  = _load_seasons(con, dump_dir),
        circuits = _load_circuits(con, dump_dir),
        drivers  = _load_drivers(con, dump_dir),
        teams    = _load_teams(con, dump_dir),
    )


# ---------------------------------------------------------------------------

def _load_championship_systems(con: sqlite3.Connection, dump_dir: pathlib.Path) -> None:
    rows = read_csv(dump_dir, "formula_one_championshipsystem.csv")
    con.executemany("""
        INSERT INTO championship_systems
          (id, jolpica_api_id, name, reference,
           driver_best_results, driver_season_split, eligibility,
           team_best_results, team_points_per_session, team_season_split)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, [(
        int(r["id"]), r["api_id"], r["name"], r["reference"],
        int(r["driver_best_results"]), int(r["driver_season_split"]),
        int(r["eligibility"]),
        int(r["team_best_results"]), int(r["team_points_per_session"]),
        int(r["team_season_split"]),
    ) for r in rows])


def _load_point_systems(con: sqlite3.Connection, dump_dir: pathlib.Path) -> None:
    rows = read_csv(dump_dir, "formula_one_pointsystem.csv")
    con.executemany("""
        INSERT INTO point_systems
          (id, jolpica_api_id, name, reference, partial,
           driver_position_points, driver_fastest_lap,
           team_position_points, team_fastest_lap,
           is_double_points, shared_drive)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, [(
        int(r["id"]), r["api_id"], r["name"], r.get("reference", ""),
        as_int(r, "partial") or 0,
        r.get("driver_position_points", ""),
        as_float(r, "driver_fastest_lap") or 0.0,
        r.get("team_position_points", ""),
        as_float(r, "team_fastest_lap") or 0.0,
        as_bool(r, "is_double_points"),
        as_int(r, "shared_drive") or 0,
    ) for r in rows])


def _load_base_teams(con: sqlite3.Connection, dump_dir: pathlib.Path) -> None:
    rows = read_csv(dump_dir, "formula_one_baseteam.csv")
    if not rows:
        return  # CSV is empty in the current dump
    con.executemany(
        "INSERT INTO base_teams (id, jolpica_api_id, name) VALUES (?,?,?)",
        [(int(r["id"]), r["api_id"], r.get("name", "")) for r in rows],
    )


def _load_seasons(con: sqlite3.Connection, dump_dir: pathlib.Path) -> dict:
    """Returns {jolpica_id: year}."""
    rows = read_csv(dump_dir, "formula_one_season.csv")
    con.executemany("""
        INSERT INTO seasons (year, jolpica_id, jolpica_api_id, championship_system_id, wikipedia)
        VALUES (?,?,?,?,?)
    """, [(
        int(r["year"]), int(r["id"]), r["api_id"],
        as_int(r, "championship_system_id"),
        r.get("wikipedia", ""),
    ) for r in rows])
    return {int(r["id"]): int(r["year"]) for r in rows}


def _load_circuits(con: sqlite3.Connection, dump_dir: pathlib.Path) -> dict:
    """Returns {jolpica_id: internal_id}."""
    rows = read_csv(dump_dir, "formula_one_circuit.csv")
    existing_slugs: set[str] = set()
    records = []
    for r in rows:
        base = r.get("reference") or slugify(r["name"])
        slug = deduplicate(base, existing_slugs)
        existing_slugs.add(slug)
        records.append((
            slug, int(r["id"]), r["api_id"],
            r["name"], r.get("locality", ""), r.get("country", ""),
            r.get("country_code", ""),
            as_float(r, "latitude"),
            as_float(r, "longitude"),
            as_int(r, "altitude"),
            r.get("reference", ""), r.get("wikipedia", ""),
        ))
    con.executemany("""
        INSERT INTO circuits
          (slug, jolpica_id, jolpica_api_id, name, locality, country, country_code,
           latitude, longitude, altitude, reference, wikipedia)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """, records)
    return {
        row["jolpica_id"]: row["id"]
        for row in con.execute("SELECT id, jolpica_id FROM circuits")
    }


def _load_drivers(con: sqlite3.Connection, dump_dir: pathlib.Path) -> dict:
    """Returns {jolpica_id: internal_id}."""
    rows = sorted(
        read_csv(dump_dir, "formula_one_driver.csv"),
        key=lambda r: (r["surname"], r["forename"], r["id"]),
    )
    existing_slugs: set[str] = set()
    records = []
    for r in rows:
        base = driver_slug(r["forename"], r["surname"])
        slug = deduplicate(base, existing_slugs)
        existing_slugs.add(slug)
        records.append((
            slug, int(r["id"]), r["api_id"],
            r["forename"], r["surname"], f"{r['forename']} {r['surname']}",
            r.get("abbreviation") or None,
            as_int(r, "permanent_car_number"),
            r.get("country_code") or None,
            r.get("nationality") or None,
            r.get("date_of_birth") or None,
            r.get("reference") or None,
            r.get("wikipedia") or None,
        ))
    con.executemany("""
        INSERT INTO drivers
          (slug, jolpica_id, jolpica_api_id, forename, surname, full_name,
           abbreviation, permanent_car_number, country_code, nationality,
           date_of_birth, reference, wikipedia)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, records)
    return {
        row["jolpica_id"]: row["id"]
        for row in con.execute("SELECT id, jolpica_id FROM drivers")
    }


def _load_teams(con: sqlite3.Connection, dump_dir: pathlib.Path) -> dict:
    """Returns {jolpica_id: internal_id}."""
    rows = read_csv(dump_dir, "formula_one_team.csv")
    existing_slugs: set[str] = set()
    records = []
    for r in rows:
        base = r.get("reference") or slugify(r["name"])
        slug = deduplicate(base, existing_slugs)
        existing_slugs.add(slug)
        records.append((
            slug, int(r["id"]), r["api_id"],
            as_int(r, "base_team_id"),
            r["name"],
            r.get("country_code") or None,
            r.get("nationality") or None,
            r.get("primary_color") or None,
            r.get("reference") or None,
            r.get("wikipedia") or None,
        ))
    con.executemany("""
        INSERT INTO teams
          (slug, jolpica_id, jolpica_api_id, base_team_id, name,
           country_code, nationality, primary_color, reference, wikipedia)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, records)
    return {
        row["jolpica_id"]: row["id"]
        for row in con.execute("SELECT id, jolpica_id FROM teams")
    }
