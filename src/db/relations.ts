import { relations } from "drizzle-orm/relations";
import { baseTeams, teams, championshipSystems, seasons, circuits, races, pointSystems, sessions, roundEntries, drivers, sessionEntries, raceResults, sprintResults, qualifyingResults, sprintQualifyingResults, driverStandings, teamStandings, championshipAdjustments } from "./schema";

export const teamsRelations = relations(teams, ({one, many}) => ({
	baseTeam: one(baseTeams, {
		fields: [teams.baseTeamId],
		references: [baseTeams.id]
	}),
	roundEntries: many(roundEntries),
	raceResults: many(raceResults),
	sprintResults: many(sprintResults),
	qualifyingResults: many(qualifyingResults),
	sprintQualifyingResults: many(sprintQualifyingResults),
	driverStandings: many(driverStandings),
	teamStandings: many(teamStandings),
	championshipAdjustments: many(championshipAdjustments),
}));

export const baseTeamsRelations = relations(baseTeams, ({many}) => ({
	teams: many(teams),
}));

export const seasonsRelations = relations(seasons, ({one, many}) => ({
	championshipSystem: one(championshipSystems, {
		fields: [seasons.championshipSystemId],
		references: [championshipSystems.id]
	}),
	races: many(races),
	championshipAdjustments: many(championshipAdjustments),
}));

export const championshipSystemsRelations = relations(championshipSystems, ({many}) => ({
	seasons: many(seasons),
}));

export const racesRelations = relations(races, ({one, many}) => ({
	circuit: one(circuits, {
		fields: [races.circuitId],
		references: [circuits.id]
	}),
	season: one(seasons, {
		fields: [races.season],
		references: [seasons.year]
	}),
	sessions: many(sessions),
	roundEntries: many(roundEntries),
	raceResults: many(raceResults),
	sprintResults: many(sprintResults),
	qualifyingResults: many(qualifyingResults),
	sprintQualifyingResults: many(sprintQualifyingResults),
	driverStandings: many(driverStandings),
	teamStandings: many(teamStandings),
}));

export const circuitsRelations = relations(circuits, ({many}) => ({
	races: many(races),
}));

export const sessionsRelations = relations(sessions, ({one, many}) => ({
	pointSystem: one(pointSystems, {
		fields: [sessions.pointSystemId],
		references: [pointSystems.id]
	}),
	race: one(races, {
		fields: [sessions.raceNumber],
		references: [races.raceNumber]
	}),
	sessionEntries: many(sessionEntries),
}));

export const pointSystemsRelations = relations(pointSystems, ({many}) => ({
	sessions: many(sessions),
}));

export const roundEntriesRelations = relations(roundEntries, ({one, many}) => ({
	team: one(teams, {
		fields: [roundEntries.teamId],
		references: [teams.id]
	}),
	driver: one(drivers, {
		fields: [roundEntries.driverId],
		references: [drivers.id]
	}),
	race: one(races, {
		fields: [roundEntries.raceNumber],
		references: [races.raceNumber]
	}),
	sessionEntries: many(sessionEntries),
}));

export const driversRelations = relations(drivers, ({many}) => ({
	roundEntries: many(roundEntries),
	raceResults: many(raceResults),
	sprintResults: many(sprintResults),
	qualifyingResults: many(qualifyingResults),
	sprintQualifyingResults: many(sprintQualifyingResults),
	driverStandings: many(driverStandings),
	championshipAdjustments: many(championshipAdjustments),
}));

export const sessionEntriesRelations = relations(sessionEntries, ({one}) => ({
	roundEntry: one(roundEntries, {
		fields: [sessionEntries.roundEntryId],
		references: [roundEntries.id]
	}),
	session: one(sessions, {
		fields: [sessionEntries.sessionId],
		references: [sessions.id]
	}),
}));

export const raceResultsRelations = relations(raceResults, ({one}) => ({
	team: one(teams, {
		fields: [raceResults.teamId],
		references: [teams.id]
	}),
	driver: one(drivers, {
		fields: [raceResults.driverId],
		references: [drivers.id]
	}),
	race: one(races, {
		fields: [raceResults.raceNumber],
		references: [races.raceNumber]
	}),
}));

export const sprintResultsRelations = relations(sprintResults, ({one}) => ({
	team: one(teams, {
		fields: [sprintResults.teamId],
		references: [teams.id]
	}),
	driver: one(drivers, {
		fields: [sprintResults.driverId],
		references: [drivers.id]
	}),
	race: one(races, {
		fields: [sprintResults.raceNumber],
		references: [races.raceNumber]
	}),
}));

export const qualifyingResultsRelations = relations(qualifyingResults, ({one}) => ({
	team: one(teams, {
		fields: [qualifyingResults.teamId],
		references: [teams.id]
	}),
	driver: one(drivers, {
		fields: [qualifyingResults.driverId],
		references: [drivers.id]
	}),
	race: one(races, {
		fields: [qualifyingResults.raceNumber],
		references: [races.raceNumber]
	}),
}));

export const sprintQualifyingResultsRelations = relations(sprintQualifyingResults, ({one}) => ({
	team: one(teams, {
		fields: [sprintQualifyingResults.teamId],
		references: [teams.id]
	}),
	driver: one(drivers, {
		fields: [sprintQualifyingResults.driverId],
		references: [drivers.id]
	}),
	race: one(races, {
		fields: [sprintQualifyingResults.raceNumber],
		references: [races.raceNumber]
	}),
}));

export const driverStandingsRelations = relations(driverStandings, ({one}) => ({
	team: one(teams, {
		fields: [driverStandings.teamId],
		references: [teams.id]
	}),
	driver: one(drivers, {
		fields: [driverStandings.driverId],
		references: [drivers.id]
	}),
	race: one(races, {
		fields: [driverStandings.raceNumber],
		references: [races.raceNumber]
	}),
}));

export const teamStandingsRelations = relations(teamStandings, ({one}) => ({
	team: one(teams, {
		fields: [teamStandings.teamId],
		references: [teams.id]
	}),
	race: one(races, {
		fields: [teamStandings.raceNumber],
		references: [races.raceNumber]
	}),
}));

export const championshipAdjustmentsRelations = relations(championshipAdjustments, ({one}) => ({
	season: one(seasons, {
		fields: [championshipAdjustments.seasonId],
		references: [seasons.year]
	}),
	team: one(teams, {
		fields: [championshipAdjustments.teamId],
		references: [teams.id]
	}),
	driver: one(drivers, {
		fields: [championshipAdjustments.driverId],
		references: [drivers.id]
	}),
}));