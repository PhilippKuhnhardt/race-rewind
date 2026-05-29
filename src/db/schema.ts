import { sqliteTable, integer, text, real, index, primaryKey, unique } from "drizzle-orm/sqlite-core";

export const championshipSystems = sqliteTable("championship_systems", {
	id: integer().primaryKey(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	name: text().notNull(),
	reference: text(),
	driverBestResults: integer("driver_best_results").default(0).notNull(),
	driverSeasonSplit: integer("driver_season_split").default(0).notNull(),
	eligibility: integer().default(1).notNull(),
	teamBestResults: integer("team_best_results").default(0).notNull(),
	teamPointsPerSession: integer("team_points_per_session").default(0).notNull(),
	teamSeasonSplit: integer("team_season_split").default(0).notNull(),
});

export const pointSystems = sqliteTable("point_systems", {
	id: integer().primaryKey(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	name: text().notNull(),
	reference: text(),
	partial: integer().default(0).notNull(),
	driverPositionPoints: text("driver_position_points"),
	driverFastestLap: real("driver_fastest_lap").notNull(),
	teamPositionPoints: text("team_position_points"),
	teamFastestLap: real("team_fastest_lap").notNull(),
	isDoublePoints: integer("is_double_points").default(0).notNull(),
	sharedDrive: integer("shared_drive").default(0).notNull(),
});

export const baseTeams = sqliteTable("base_teams", {
	id: integer().primaryKey(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	name: text(),
});

export const drivers = sqliteTable("drivers", {
	id: integer().primaryKey({ autoIncrement: true }),
	slug: text().notNull().unique(),
	jolpicaId: integer("jolpica_id").notNull().unique(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	forename: text().notNull(),
	surname: text().notNull(),
	fullName: text("full_name").notNull(),
	abbreviation: text(),
	permanentCarNumber: integer("permanent_car_number"),
	countryCode: text("country_code"),
	nationality: text(),
	dateOfBirth: text("date_of_birth"),
	reference: text(),
	wikipedia: text(),
});

export const teams = sqliteTable("teams", {
	id: integer().primaryKey({ autoIncrement: true }),
	slug: text().notNull().unique(),
	jolpicaId: integer("jolpica_id").notNull().unique(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	baseTeamId: integer("base_team_id").references(() => baseTeams.id),
	name: text().notNull(),
	countryCode: text("country_code"),
	nationality: text(),
	primaryColor: text("primary_color"),
	reference: text(),
	wikipedia: text(),
});

export const circuits = sqliteTable("circuits", {
	id: integer().primaryKey({ autoIncrement: true }),
	slug: text().notNull().unique(),
	jolpicaId: integer("jolpica_id").notNull().unique(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	name: text().notNull(),
	locality: text(),
	country: text(),
	countryCode: text("country_code"),
	latitude: real(),
	longitude: real(),
	altitude: integer(),
	reference: text(),
	wikipedia: text(),
});

export const seasons = sqliteTable("seasons", {
	year: integer().primaryKey(),
	jolpicaId: integer("jolpica_id").notNull().unique(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	championshipSystemId: integer("championship_system_id").references(() => championshipSystems.id),
	wikipedia: text(),
});

export const races = sqliteTable("races", {
	raceNumber: integer("race_number").primaryKey(),
	slug: text().notNull().unique(),
	jolpicaId: integer("jolpica_id").notNull().unique(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	season: integer().notNull().references(() => seasons.year),
	round: integer().notNull(),
	circuitId: integer("circuit_id").notNull().references(() => circuits.id),
	name: text().notNull(),
	date: text().notNull(),
	hasSprint: integer("has_sprint").default(0).notNull(),
	prevRaceInSeason: integer("prev_race_in_season"),
	isFinalRound: integer("is_final_round").default(0).notNull(),
	poleDriverId: integer("pole_driver_id").references(() => drivers.id),
	wikipedia: text(),
},
(table) => [
	index("idx_races_season").on(table.season),
	index("idx_races_final").on(table.isFinalRound),
	unique("races_season_round_unique").on(table.season, table.round),
]);

export const sessions = sqliteTable("sessions", {
	id: integer().primaryKey({ autoIncrement: true }),
	jolpicaId: integer("jolpica_id").notNull().unique(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	raceNumber: integer("race_number").notNull().references(() => races.raceNumber),
	type: text().notNull(),
	number: integer(),
	pointSystemId: integer("point_system_id").references(() => pointSystems.id),
	scheduledLaps: integer("scheduled_laps"),
	timestamp: text(),
	timezone: text(),
	hasTimeData: integer("has_time_data").default(0).notNull(),
	isCancelled: integer("is_cancelled").default(0).notNull(),
},
(table) => [
	index("idx_sessions_race").on(table.raceNumber, table.type),
]);

export const roundEntries = sqliteTable("round_entries", {
	id: integer().primaryKey({ autoIncrement: true }),
	jolpicaId: integer("jolpica_id").notNull().unique(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	raceNumber: integer("race_number").notNull().references(() => races.raceNumber),
	driverId: integer("driver_id").notNull().references(() => drivers.id),
	teamId: integer("team_id").notNull().references(() => teams.id),
	carNumber: integer("car_number"),
},
(table) => [
	index("idx_round_entries_driver").on(table.driverId),
	index("idx_round_entries_race").on(table.raceNumber),
]);

export const sessionEntries = sqliteTable("session_entries", {
	id: integer().primaryKey({ autoIncrement: true }),
	jolpicaId: integer("jolpica_id").notNull().unique(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	sessionId: integer("session_id").notNull().references(() => sessions.id),
	roundEntryId: integer("round_entry_id").notNull().references(() => roundEntries.id),
	grid: integer(),
	position: integer(),
	lapsCompleted: integer("laps_completed"),
	status: integer(),
	detail: text(),
	time: text(),
	points: real(),
	isClassified: integer("is_classified"),
	isEligibleForPoints: integer("is_eligible_for_points"),
	fastestLapRank: integer("fastest_lap_rank"),
},
(table) => [
	index("idx_session_entries_round_entry").on(table.roundEntryId),
	index("idx_session_entries_session").on(table.sessionId),
	unique("session_entries_session_round_entry_unique").on(table.sessionId, table.roundEntryId),
]);

export const raceResults = sqliteTable("race_results", {
	raceNumber: integer("race_number").notNull().references(() => races.raceNumber),
	driverId: integer("driver_id").notNull().references(() => drivers.id),
	teamId: integer("team_id").notNull().references(() => teams.id),
	carNumber: integer("car_number"),
	grid: integer(),
	position: integer(),
	status: integer(),
	detail: text(),
	time: text(),
	lapsCompleted: integer("laps_completed"),
	points: real(),
	isClassified: integer("is_classified"),
	fastestLapRank: integer("fastest_lap_rank"),
	pitStopCount: integer("pit_stop_count"),
},
(table) => [
	index("idx_race_results_team").on(table.teamId, table.raceNumber),
	index("idx_race_results_driver").on(table.driverId, table.raceNumber),
	primaryKey({ columns: [table.raceNumber, table.driverId], name: "race_results_race_number_driver_id_pk"})
]);

export const sprintResults = sqliteTable("sprint_results", {
	raceNumber: integer("race_number").notNull().references(() => races.raceNumber),
	driverId: integer("driver_id").notNull().references(() => drivers.id),
	teamId: integer("team_id").notNull().references(() => teams.id),
	carNumber: integer("car_number"),
	grid: integer(),
	position: integer(),
	status: integer(),
	detail: text(),
	time: text(),
	lapsCompleted: integer("laps_completed"),
	points: real(),
	isClassified: integer("is_classified"),
	fastestLapRank: integer("fastest_lap_rank"),
	pitStopCount: integer("pit_stop_count"),
},
(table) => [
	index("idx_sprint_results_driver").on(table.driverId),
	primaryKey({ columns: [table.raceNumber, table.driverId], name: "sprint_results_race_number_driver_id_pk"})
]);

export const qualifyingResults = sqliteTable("qualifying_results", {
	raceNumber: integer("race_number").notNull().references(() => races.raceNumber),
	driverId: integer("driver_id").notNull().references(() => drivers.id),
	teamId: integer("team_id").notNull().references(() => teams.id),
	position: integer(),
	q1Time: text("q1_time"),
	q2Time: text("q2_time"),
	q3Time: text("q3_time"),
	qualifyingTime: text("qualifying_time"),
	knockedOutIn: text("knocked_out_in"),
},
(table) => [
	index("idx_qualifying_results_driver").on(table.driverId),
	primaryKey({ columns: [table.raceNumber, table.driverId], name: "qualifying_results_race_number_driver_id_pk"})
]);

export const sprintQualifyingResults = sqliteTable("sprint_qualifying_results", {
	raceNumber: integer("race_number").notNull().references(() => races.raceNumber),
	driverId: integer("driver_id").notNull().references(() => drivers.id),
	teamId: integer("team_id").notNull().references(() => teams.id),
	position: integer(),
	sq1Time: text("sq1_time"),
	sq2Time: text("sq2_time"),
	sq3Time: text("sq3_time"),
	knockedOutIn: text("knocked_out_in"),
},
(table) => [
	primaryKey({ columns: [table.raceNumber, table.driverId], name: "sprint_qualifying_results_race_number_driver_id_pk"})
]);

export const driverStandings = sqliteTable("driver_standings", {
	raceNumber: integer("race_number").notNull().references(() => races.raceNumber),
	driverId: integer("driver_id").notNull().references(() => drivers.id),
	teamId: integer("team_id").references(() => teams.id),
	position: integer(),
	points: real().notNull(),
	winCount: integer("win_count").notNull(),
	highestFinish: integer("highest_finish"),
	isEligible: integer("is_eligible").notNull(),
	adjustmentType: integer("adjustment_type").default(0).notNull(),
},
(table) => [
	index("idx_driver_standings_race").on(table.raceNumber, table.position),
	index("idx_driver_standings_driver").on(table.driverId, table.raceNumber),
	primaryKey({ columns: [table.raceNumber, table.driverId], name: "driver_standings_race_number_driver_id_pk"})
]);

export const teamStandings = sqliteTable("team_standings", {
	raceNumber: integer("race_number").notNull().references(() => races.raceNumber),
	teamId: integer("team_id").notNull().references(() => teams.id),
	position: integer(),
	points: real().notNull(),
	winCount: integer("win_count").notNull(),
	highestFinish: integer("highest_finish"),
	isEligible: integer("is_eligible").notNull(),
	adjustmentType: integer("adjustment_type").default(0).notNull(),
},
(table) => [
	index("idx_team_standings_race").on(table.raceNumber, table.position),
	index("idx_team_standings_team").on(table.teamId, table.raceNumber),
	primaryKey({ columns: [table.raceNumber, table.teamId], name: "team_standings_race_number_team_id_pk"})
]);

export const championshipAdjustments = sqliteTable("championship_adjustments", {
	id: integer().primaryKey(),
	jolpicaApiId: text("jolpica_api_id").notNull().unique(),
	adjustment: integer(),
	points: real(),
	driverId: integer("driver_id").references(() => drivers.id),
	teamId: integer("team_id").references(() => teams.id),
	seasonId: integer("season_id").references(() => seasons.year),
});

export const driverCareerProgression = sqliteTable("driver_career_progression", {
	driverId: integer("driver_id").notNull().references(() => drivers.id),
	raceNumber: integer("race_number").notNull().references(() => races.raceNumber),
	cumStarts: integer("cum_starts").notNull(),
	cumWins: integer("cum_wins").notNull(),
	cumPodiums: integer("cum_podiums").notNull(),
	cumPoles: integer("cum_poles").notNull(),
	cumFastestLaps: integer("cum_fastest_laps").notNull(),
	cumPoints: real("cum_points").notNull(),
	cumChampionships: integer("cum_championships").notNull(),
},
(table) => [
	primaryKey({ columns: [table.driverId, table.raceNumber], name: "driver_career_progression_pk" }),
	index("idx_driver_career_race").on(table.raceNumber),
	index("idx_driver_career_driver").on(table.driverId, table.raceNumber),
]);

export const teamCareerProgression = sqliteTable("team_career_progression", {
	teamId: integer("team_id").notNull().references(() => teams.id),
	raceNumber: integer("race_number").notNull().references(() => races.raceNumber),
	cumEntries: integer("cum_entries").notNull(),
	cumWins: integer("cum_wins").notNull(),
	cumPodiums: integer("cum_podiums").notNull(),
	cumPoles: integer("cum_poles").notNull(),
	cumFastestLaps: integer("cum_fastest_laps").notNull(),
	cumPoints: real("cum_points").notNull(),
	cumChampionships: integer("cum_championships").notNull(),
	cumDriversFielded: integer("cum_drivers_fielded").notNull(),
},
(t) => [
	primaryKey({ columns: [t.teamId, t.raceNumber], name: "team_career_progression_pk" }),
	index("idx_team_career_race").on(t.raceNumber),
	index("idx_team_career_team").on(t.teamId, t.raceNumber),
]);
