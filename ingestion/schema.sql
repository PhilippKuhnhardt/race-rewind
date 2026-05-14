-- F1 History — SQLite schema
-- Source of truth. Applied fresh on every ingest (drop + recreate).
-- See architecture.md for rationale.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------

CREATE TABLE championship_systems (
    id                      INTEGER PRIMARY KEY,
    jolpica_api_id          TEXT    NOT NULL UNIQUE,
    name                    TEXT    NOT NULL,
    reference               TEXT,
    driver_best_results     INTEGER NOT NULL DEFAULT 0,
    driver_season_split     INTEGER NOT NULL DEFAULT 0,
    eligibility             INTEGER NOT NULL DEFAULT 1,
    team_best_results       INTEGER NOT NULL DEFAULT 0,
    team_points_per_session INTEGER NOT NULL DEFAULT 0,
    team_season_split       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE point_systems (
    id                      INTEGER PRIMARY KEY,
    jolpica_api_id          TEXT    NOT NULL UNIQUE,
    name                    TEXT    NOT NULL,
    reference               TEXT,
    partial                 INTEGER NOT NULL DEFAULT 0,
    driver_position_points  TEXT,   -- JSON array e.g. "[25,18,15,...]"
    driver_fastest_lap      REAL    NOT NULL DEFAULT 0,
    team_position_points    TEXT,   -- JSON array
    team_fastest_lap        REAL    NOT NULL DEFAULT 0,
    is_double_points        INTEGER NOT NULL DEFAULT 0,
    shared_drive            INTEGER NOT NULL DEFAULT 0
);

-- Lineage groups for constructor identity across renames (Benetton→Renault→Alpine).
-- The CSV is currently empty but kept for forward-compat.
CREATE TABLE base_teams (
    id              INTEGER PRIMARY KEY,
    jolpica_api_id  TEXT    NOT NULL UNIQUE,
    name            TEXT
);

-- ---------------------------------------------------------------------------
-- Dimension tables
-- ---------------------------------------------------------------------------

CREATE TABLE drivers (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    slug                 TEXT    NOT NULL UNIQUE,  -- "michael-schumacher"
    jolpica_id           INTEGER NOT NULL UNIQUE,
    jolpica_api_id       TEXT    NOT NULL UNIQUE,
    forename             TEXT    NOT NULL,
    surname              TEXT    NOT NULL,
    full_name            TEXT    NOT NULL,          -- forename + " " + surname
    abbreviation         TEXT,                      -- "VER", modern era only
    permanent_car_number INTEGER,
    country_code         TEXT,                      -- ISO-3 e.g. "GBR"
    nationality          TEXT,
    date_of_birth        TEXT,                      -- ISO date
    reference            TEXT,                      -- jolpica slug ("schumacher")
    wikipedia            TEXT
);

CREATE TABLE teams (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT    NOT NULL UNIQUE,
    jolpica_id      INTEGER NOT NULL UNIQUE,
    jolpica_api_id  TEXT    NOT NULL UNIQUE,
    base_team_id    INTEGER REFERENCES base_teams(id),
    name            TEXT    NOT NULL,
    country_code    TEXT,
    nationality     TEXT,
    primary_color   TEXT,
    reference       TEXT,
    wikipedia       TEXT
);

CREATE TABLE circuits (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT    NOT NULL UNIQUE,
    jolpica_id      INTEGER NOT NULL UNIQUE,
    jolpica_api_id  TEXT    NOT NULL UNIQUE,
    name            TEXT    NOT NULL,
    locality        TEXT,
    country         TEXT,
    country_code    TEXT,
    latitude        REAL,
    longitude       REAL,
    altitude        INTEGER,
    reference       TEXT,
    wikipedia       TEXT
);

CREATE TABLE seasons (
    year                   INTEGER PRIMARY KEY,
    jolpica_id             INTEGER NOT NULL UNIQUE,
    jolpica_api_id         TEXT    NOT NULL UNIQUE,
    championship_system_id INTEGER REFERENCES championship_systems(id),
    wikipedia              TEXT
);

-- ---------------------------------------------------------------------------
-- Timeline
-- ---------------------------------------------------------------------------

-- race_number = jolpica's global race counter verbatim (1..N across all seasons).
-- Cancelled rounds are excluded (they have a null race_number in the source).
CREATE TABLE races (
    race_number     INTEGER PRIMARY KEY,
    slug            TEXT    NOT NULL UNIQUE,  -- "1998-hungarian-grand-prix"
    jolpica_id      INTEGER NOT NULL UNIQUE,
    jolpica_api_id  TEXT    NOT NULL UNIQUE,
    season          INTEGER NOT NULL REFERENCES seasons(year),
    round           INTEGER NOT NULL,         -- position within season
    circuit_id      INTEGER NOT NULL REFERENCES circuits(id),
    name            TEXT    NOT NULL,
    date            TEXT    NOT NULL,         -- ISO date of the race session
    has_sprint      INTEGER NOT NULL DEFAULT 0,
    wikipedia       TEXT,
    UNIQUE (season, round)
);

CREATE INDEX idx_races_season ON races(season);

-- One row per session within a round.
-- Types: R (race), SR (sprint race), Q1/Q2/Q3, SQ1/SQ2/SQ3,
--        FP1/FP2/FP3, QB (old qualifying), QO, QA
CREATE TABLE sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    jolpica_id      INTEGER NOT NULL UNIQUE,
    jolpica_api_id  TEXT    NOT NULL UNIQUE,
    race_number     INTEGER NOT NULL REFERENCES races(race_number),
    type            TEXT    NOT NULL,
    number          INTEGER,              -- session order within round
    point_system_id INTEGER REFERENCES point_systems(id),
    scheduled_laps  INTEGER,
    timestamp       TEXT,                 -- ISO with TZ offset
    timezone        TEXT,                 -- IANA
    has_time_data   INTEGER NOT NULL DEFAULT 0,
    is_cancelled    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sessions_race ON sessions(race_number, type);

-- ---------------------------------------------------------------------------
-- Entries
-- ---------------------------------------------------------------------------

-- One row per (round, driver, car). Most rounds have exactly one row per driver.
-- Rare exceptions (shared drives, multi-car entries in early eras) produce two rows
-- per (race_number, driver_id); both are kept so their session_entries refs are valid.
-- race_results deduplicates to the better result per (race_number, driver_id).
CREATE TABLE round_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    jolpica_id      INTEGER NOT NULL UNIQUE,
    jolpica_api_id  TEXT    NOT NULL UNIQUE,
    race_number     INTEGER NOT NULL REFERENCES races(race_number),
    driver_id       INTEGER NOT NULL REFERENCES drivers(id),
    team_id         INTEGER NOT NULL REFERENCES teams(id),
    car_number      INTEGER
);

CREATE INDEX idx_round_entries_race   ON round_entries(race_number);
CREATE INDEX idx_round_entries_driver ON round_entries(driver_id);

-- Raw session results. All session types. Source of truth for the derived tables below.
CREATE TABLE session_entries (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    jolpica_id              INTEGER NOT NULL UNIQUE,
    jolpica_api_id          TEXT    NOT NULL UNIQUE,
    session_id              INTEGER NOT NULL REFERENCES sessions(id),
    round_entry_id          INTEGER NOT NULL REFERENCES round_entries(id),
    grid                    INTEGER,
    position                INTEGER,
    laps_completed          INTEGER,
    status                  INTEGER,  -- jolpica numeric status code
    detail                  TEXT,     -- "Finished", "Engine", "Accident", ...
    time                    TEXT,     -- winner: elapsed; others: "+gap" or null
    points                  REAL,
    is_classified           INTEGER,
    is_eligible_for_points  INTEGER,
    fastest_lap_rank        INTEGER,
    UNIQUE (session_id, round_entry_id)
);

CREATE INDEX idx_session_entries_session       ON session_entries(session_id);
CREATE INDEX idx_session_entries_round_entry   ON session_entries(round_entry_id);

-- ---------------------------------------------------------------------------
-- Denormalised result tables (pre-joined for fast page builds)
-- ---------------------------------------------------------------------------

-- Final race classification. One row per (round, driver), session.type = 'R'.
CREATE TABLE race_results (
    race_number      INTEGER NOT NULL REFERENCES races(race_number),
    driver_id        INTEGER NOT NULL REFERENCES drivers(id),
    team_id          INTEGER NOT NULL REFERENCES teams(id),
    car_number       INTEGER,
    grid             INTEGER,
    position         INTEGER,   -- null = DNF/DNS
    status           INTEGER,
    detail           TEXT,
    time             TEXT,
    laps_completed   INTEGER,
    points           REAL,
    is_classified    INTEGER,
    fastest_lap_rank INTEGER,   -- 1 = set the race fastest lap
    pit_stop_count   INTEGER,   -- aggregated at ingest from formula_one_pitstop.csv
    PRIMARY KEY (race_number, driver_id)
);

CREATE INDEX idx_race_results_driver ON race_results(driver_id, race_number);
CREATE INDEX idx_race_results_team   ON race_results(team_id,   race_number);

-- Sprint race results. session.type = 'SR'.
CREATE TABLE sprint_results (
    race_number      INTEGER NOT NULL REFERENCES races(race_number),
    driver_id        INTEGER NOT NULL REFERENCES drivers(id),
    team_id          INTEGER NOT NULL REFERENCES teams(id),
    car_number       INTEGER,
    grid             INTEGER,
    position         INTEGER,
    status           INTEGER,
    detail           TEXT,
    time             TEXT,
    laps_completed   INTEGER,
    points           REAL,
    is_classified    INTEGER,
    fastest_lap_rank INTEGER,
    pit_stop_count   INTEGER,
    PRIMARY KEY (race_number, driver_id)
);

CREATE INDEX idx_sprint_results_driver ON sprint_results(driver_id);

-- Qualifying classification. One row per (race, driver).
-- Modern era (2006+): q1/q2/q3 columns; pre-2006: qualifying_time column.
CREATE TABLE qualifying_results (
    race_number      INTEGER NOT NULL REFERENCES races(race_number),
    driver_id        INTEGER NOT NULL REFERENCES drivers(id),
    team_id          INTEGER NOT NULL REFERENCES teams(id),
    position         INTEGER,    -- qualifying order = grid slot (pre-penalty)
    q1_time          TEXT,
    q2_time          TEXT,
    q3_time          TEXT,
    qualifying_time  TEXT,       -- pre-knockout eras: best lap across all qualifying sessions
    knocked_out_in   TEXT,       -- "Q1" | "Q2" | "Q3" | null
    PRIMARY KEY (race_number, driver_id)
);

CREATE INDEX idx_qualifying_results_driver ON qualifying_results(driver_id);

-- Sprint qualifying. session.type IN ('SQ1','SQ2','SQ3').
CREATE TABLE sprint_qualifying_results (
    race_number    INTEGER NOT NULL REFERENCES races(race_number),
    driver_id      INTEGER NOT NULL REFERENCES drivers(id),
    team_id        INTEGER NOT NULL REFERENCES teams(id),
    position       INTEGER,
    sq1_time       TEXT,
    sq2_time       TEXT,
    sq3_time       TEXT,
    knocked_out_in TEXT,
    PRIMARY KEY (race_number, driver_id)
);

-- ---------------------------------------------------------------------------
-- Standings snapshots (the time-travel core)
-- ---------------------------------------------------------------------------

-- One row per (race, driver) = post-final-scoring-session of that round.
-- Sourced directly from formula_one_driverchampionship, deduped to highest
-- session_number per (round_id, driver_id).
CREATE TABLE driver_standings (
    race_number     INTEGER NOT NULL REFERENCES races(race_number),
    driver_id       INTEGER NOT NULL REFERENCES drivers(id),
    position        INTEGER,          -- null when driver is not eligible for championship
    points          REAL    NOT NULL,
    win_count       INTEGER NOT NULL,
    highest_finish  INTEGER,
    is_eligible     INTEGER NOT NULL,
    adjustment_type INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (race_number, driver_id)
);

-- Covering index: look up a driver's standings history or find the table at race N.
CREATE INDEX idx_driver_standings_driver ON driver_standings(driver_id, race_number);
CREATE INDEX idx_driver_standings_race   ON driver_standings(race_number, position);

CREATE TABLE team_standings (
    race_number     INTEGER NOT NULL REFERENCES races(race_number),
    team_id         INTEGER NOT NULL REFERENCES teams(id),
    position        INTEGER,
    points          REAL    NOT NULL,
    win_count       INTEGER NOT NULL,
    highest_finish  INTEGER,
    is_eligible     INTEGER NOT NULL,
    adjustment_type INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (race_number, team_id)
);

CREATE INDEX idx_team_standings_team ON team_standings(team_id, race_number);
CREATE INDEX idx_team_standings_race ON team_standings(race_number, position);

-- Championship penalties/adjustments (e.g. Schumacher DSQ 1997).
CREATE TABLE championship_adjustments (
    id              INTEGER PRIMARY KEY,
    jolpica_api_id  TEXT    NOT NULL UNIQUE,
    adjustment      INTEGER,
    points          REAL,
    driver_id       INTEGER REFERENCES drivers(id),
    team_id         INTEGER REFERENCES teams(id),
    season_id       INTEGER REFERENCES seasons(year)
);
