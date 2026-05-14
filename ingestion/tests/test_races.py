"""
Era spot-checks — one verified race per distinct era/format.
Each test encodes facts confirmed against Wikipedia so regressions are caught
if the schema, ingestion logic, or source dump ever changes.

Eras covered:
  2023  Bahrain GP       — modern (Q1/Q2/Q3 with lap times, sprint-less)
  2004  European GP      — single-lap qualifying era
  1971  Canadian GP      — classic era, no qualifying data
  1952  British GP       — early championship, pre-knockout qualifying
  1956  Belgian GP       — early era with shared drive
"""

import pathlib
import sqlite3

import pytest

DB_PATH = pathlib.Path(__file__).parents[2] / "data" / "f1-history.sqlite"


@pytest.fixture(scope="module")
def con():
    if not DB_PATH.exists():
        pytest.skip("data/f1-history.sqlite not found — run ingestion first")
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    yield c
    c.close()


def race(con, slug):
    r = con.execute("SELECT * FROM races WHERE slug=?", (slug,)).fetchone()
    assert r is not None, f"Race not found: {slug}"
    return r


def results(con, race_number):
    return {
        row["full_name"]: row
        for row in con.execute("""
            SELECT d.full_name, rr.position, rr.grid, rr.laps_completed,
                   rr.points, rr.detail, rr.car_number, rr.fastest_lap_rank,
                   rr.pit_stop_count, t.name AS team
            FROM race_results rr
            JOIN drivers d ON d.id = rr.driver_id
            JOIN teams   t ON t.id = rr.team_id
            WHERE rr.race_number = ?
        """, (race_number,))
    }


def qualifying(con, race_number):
    return {
        row["full_name"]: row
        for row in con.execute("""
            SELECT d.full_name, qr.position, qr.q1_time, qr.q2_time, qr.q3_time,
                   qr.qualifying_time, qr.knocked_out_in
            FROM qualifying_results qr
            JOIN drivers d ON d.id = qr.driver_id
            WHERE qr.race_number = ?
        """, (race_number,))
    }


def standings(con, race_number):
    return {
        row["full_name"]: row
        for row in con.execute("""
            SELECT d.full_name, ds.position, ds.points, ds.win_count
            FROM driver_standings ds
            JOIN drivers d ON d.id = ds.driver_id
            WHERE ds.race_number = ? AND ds.position IS NOT NULL
        """, (race_number,))
    }


# ---------------------------------------------------------------------------
# 2023 Bahrain Grand Prix — modern era
# ---------------------------------------------------------------------------

class Test2023Bahrain:
    SLUG = "2023-bahrain-grand-prix"

    def test_race_meta(self, con):
        r = race(con, self.SLUG)
        assert r["season"] == 2023
        assert r["round"] == 1
        assert r["date"] == "2023-03-05"
        assert r["has_sprint"] == 0

    def test_race_result_top3(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Max Verstappen"]["position"] == 1
        assert rr["Max Verstappen"]["laps_completed"] == 57
        assert rr["Max Verstappen"]["grid"] == 1
        assert rr["Sergio Pérez"]["position"] == 2
        assert rr["Fernando Alonso"]["position"] == 3
        assert rr["Fernando Alonso"]["grid"] == 5   # came from P5

    def test_leclerc_retired(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Charles Leclerc"]["grid"] == 3
        assert rr["Charles Leclerc"]["laps_completed"] == 39

    def test_zhou_fastest_lap(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Guanyu Zhou"]["fastest_lap_rank"] == 1

    def test_qualifying_pole(self, con):
        rn = race(con, self.SLUG)["race_number"]
        q = qualifying(con, rn)
        assert q["Max Verstappen"]["position"] == 1
        assert q["Max Verstappen"]["q3_time"] == "00:01:29.708"
        assert q["Sergio Pérez"]["q3_time"] == "00:01:29.846"

    def test_qualifying_knockouts(self, con):
        rn = race(con, self.SLUG)["race_number"]
        q = qualifying(con, rn)
        assert q["Lando Norris"]["knocked_out_in"] == "Q2"
        assert q["Pierre Gasly"]["knocked_out_in"] == "Q1"

    def test_standings(self, con):
        rn = race(con, self.SLUG)["race_number"]
        s = standings(con, rn)
        assert s["Max Verstappen"]["position"] == 1
        assert s["Max Verstappen"]["points"] == 25.0
        assert s["Sergio Pérez"]["position"] == 2
        assert s["Fernando Alonso"]["position"] == 3

    def test_constructor_standings(self, con):
        rn = race(con, self.SLUG)["race_number"]
        ts = con.execute("""
            SELECT t.name, ts.position, ts.points
            FROM team_standings ts JOIN teams t ON t.id = ts.team_id
            WHERE ts.race_number = ? AND ts.position IS NOT NULL
            ORDER BY ts.position
        """, (rn,)).fetchall()
        top = {r["name"]: r for r in ts}
        assert top["Red Bull"]["position"] == 1
        assert top["Red Bull"]["points"] == 43.0
        assert top["Aston Martin"]["position"] == 2


# ---------------------------------------------------------------------------
# 2004 European Grand Prix (Nürburgring) — single-lap qualifying era
# ---------------------------------------------------------------------------

class Test2004European:
    SLUG = "2004-european-grand-prix"

    def test_race_meta(self, con):
        r = race(con, self.SLUG)
        assert r["season"] == 2004
        assert r["round"] == 7
        assert r["date"] == "2004-05-30"

    def test_winner(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Michael Schumacher"]["position"] == 1
        assert rr["Michael Schumacher"]["grid"] == 1
        assert rr["Michael Schumacher"]["laps_completed"] == 60
        assert rr["Michael Schumacher"]["fastest_lap_rank"] == 1

    def test_barrichello_from_back(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Rubens Barrichello"]["position"] == 2
        assert rr["Rubens Barrichello"]["grid"] == 7

    def test_raikkonen_retired(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Kimi Räikkönen"]["grid"] == 4
        assert rr["Kimi Räikkönen"]["laps_completed"] == 9

    def test_single_lap_qualifying(self, con):
        # 2004 used one-shot qualifying — no Q1/Q2/Q3, just qualifying_time
        rn = race(con, self.SLUG)["race_number"]
        q = qualifying(con, rn)
        assert q["Michael Schumacher"]["position"] == 1
        assert q["Michael Schumacher"]["qualifying_time"] == "00:01:28.351"
        assert q["Michael Schumacher"]["q1_time"] is None
        assert q["Michael Schumacher"]["q3_time"] is None

    def test_standings_after(self, con):
        rn = race(con, self.SLUG)["race_number"]
        s = standings(con, rn)
        assert s["Michael Schumacher"]["position"] == 1
        assert s["Michael Schumacher"]["points"] == 60.0
        assert s["Michael Schumacher"]["win_count"] == 6


# ---------------------------------------------------------------------------
# 1971 Canadian Grand Prix — classic era, no qualifying data
# ---------------------------------------------------------------------------

class Test1971Canadian:
    SLUG = "1971-canadian-grand-prix"

    def test_race_meta(self, con):
        r = race(con, self.SLUG)
        assert r["season"] == 1971
        assert r["round"] == 10
        assert r["date"] == "1971-09-19"

    def test_winner(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Jackie Stewart"]["position"] == 1
        assert rr["Jackie Stewart"]["grid"] == 1
        assert rr["Jackie Stewart"]["laps_completed"] == 64

    def test_podium(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Ronnie Peterson"]["position"] == 2
        assert rr["Mark Donohue"]["position"] == 3

    def test_no_qualifying_data(self, con):
        rn = race(con, self.SLUG)["race_number"]
        q = qualifying(con, rn)
        assert len(q) == 0

    def test_standings_after(self, con):
        rn = race(con, self.SLUG)["race_number"]
        s = standings(con, rn)
        assert s["Jackie Stewart"]["position"] == 1
        assert s["Jackie Stewart"]["points"] == 60.0
        assert s["Ronnie Peterson"]["position"] == 2

    def test_points_system(self, con):
        # 1971 used 9-6-4-3-2-1 scoring
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Jackie Stewart"]["points"] == 9.0
        assert rr["Ronnie Peterson"]["points"] == 6.0
        assert rr["Mark Donohue"]["points"] == 4.0


# ---------------------------------------------------------------------------
# 1952 British Grand Prix (Silverstone) — early championship era
# ---------------------------------------------------------------------------

class Test1952British:
    SLUG = "1952-british-grand-prix"

    def test_race_meta(self, con):
        r = race(con, self.SLUG)
        assert r["season"] == 1952
        assert r["round"] == 5
        assert r["date"] == "1952-07-19"

    def test_winner(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Alberto Ascari"]["position"] == 1
        assert rr["Alberto Ascari"]["laps_completed"] == 85

    def test_farina_from_pole(self, con):
        # Farina started P1 (pole) but finished P6
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Nino Farina"]["grid"] == 1
        assert rr["Nino Farina"]["position"] == 6

    def test_moss_retired(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Stirling Moss"]["laps_completed"] == 36

    def test_no_qualifying_data(self, con):
        rn = race(con, self.SLUG)["race_number"]
        q = qualifying(con, rn)
        assert len(q) == 0

    def test_standings_after(self, con):
        rn = race(con, self.SLUG)["race_number"]
        s = standings(con, rn)
        assert s["Alberto Ascari"]["position"] == 1
        assert s["Alberto Ascari"]["points"] == 27.0
        assert s["Alberto Ascari"]["win_count"] == 3


# ---------------------------------------------------------------------------
# 1956 Belgian Grand Prix (Spa) — shared drive
# ---------------------------------------------------------------------------

class Test1956Belgian:
    SLUG = "1956-belgian-grand-prix"

    def test_race_meta(self, con):
        r = race(con, self.SLUG)
        assert r["season"] == 1956
        assert r["round"] == 4
        assert r["date"] == "1956-06-03"

    def test_winner(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Peter Collins"]["position"] == 1
        assert rr["Peter Collins"]["laps_completed"] == 36

    def test_shared_drive(self, con):
        # Moss and Perdisa shared car #34; both classified P3 with split points
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Stirling Moss"]["position"] == 3
        assert rr["Stirling Moss"]["car_number"] == 34
        assert rr["Cesare Perdisa"]["position"] == 3
        assert rr["Cesare Perdisa"]["car_number"] == 34
        # Points split: 3+2 = 5 total for the shared P3 result
        assert rr["Stirling Moss"]["points"] + rr["Cesare Perdisa"]["points"] == 5.0

    def test_fangio_retired_from_pole(self, con):
        rn = race(con, self.SLUG)["race_number"]
        rr = results(con, rn)
        assert rr["Juan Fangio"]["grid"] == 1
        assert rr["Juan Fangio"]["laps_completed"] == 23

    def test_no_qualifying_data(self, con):
        rn = race(con, self.SLUG)["race_number"]
        q = qualifying(con, rn)
        assert len(q) == 0

    def test_standings_after(self, con):
        rn = race(con, self.SLUG)["race_number"]
        s = standings(con, rn)
        assert s["Peter Collins"]["points"] == 11.0
        assert s["Stirling Moss"]["points"] == 11.0
        # Fangio had already won one race but retired here
        assert s["Juan Fangio"]["win_count"] == 1
