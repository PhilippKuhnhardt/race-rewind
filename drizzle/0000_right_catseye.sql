CREATE TABLE `base_teams` (
	`id` integer PRIMARY KEY NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `base_teams_jolpica_api_id_unique` ON `base_teams` (`jolpica_api_id`);--> statement-breakpoint
CREATE TABLE `championship_adjustments` (
	`id` integer PRIMARY KEY NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`adjustment` integer,
	`points` real,
	`driver_id` integer,
	`team_id` integer,
	`season_id` integer,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`year`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `championship_adjustments_jolpica_api_id_unique` ON `championship_adjustments` (`jolpica_api_id`);--> statement-breakpoint
CREATE TABLE `championship_systems` (
	`id` integer PRIMARY KEY NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`name` text NOT NULL,
	`reference` text,
	`driver_best_results` integer DEFAULT 0 NOT NULL,
	`driver_season_split` integer DEFAULT 0 NOT NULL,
	`eligibility` integer DEFAULT 1 NOT NULL,
	`team_best_results` integer DEFAULT 0 NOT NULL,
	`team_points_per_session` integer DEFAULT 0 NOT NULL,
	`team_season_split` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `championship_systems_jolpica_api_id_unique` ON `championship_systems` (`jolpica_api_id`);--> statement-breakpoint
CREATE TABLE `circuits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`jolpica_id` integer NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`name` text NOT NULL,
	`locality` text,
	`country` text,
	`country_code` text,
	`latitude` real,
	`longitude` real,
	`altitude` integer,
	`reference` text,
	`wikipedia` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `circuits_slug_unique` ON `circuits` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `circuits_jolpica_id_unique` ON `circuits` (`jolpica_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `circuits_jolpica_api_id_unique` ON `circuits` (`jolpica_api_id`);--> statement-breakpoint
CREATE TABLE `driver_career_progression` (
	`driver_id` integer NOT NULL,
	`race_number` integer NOT NULL,
	`cum_starts` integer NOT NULL,
	`cum_wins` integer NOT NULL,
	`cum_podiums` integer NOT NULL,
	`cum_poles` integer NOT NULL,
	`cum_fastest_laps` integer NOT NULL,
	`cum_points` real NOT NULL,
	`cum_championships` integer NOT NULL,
	PRIMARY KEY(`driver_id`, `race_number`),
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`race_number`) REFERENCES `races`(`race_number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_driver_career_race` ON `driver_career_progression` (`race_number`);--> statement-breakpoint
CREATE INDEX `idx_driver_career_driver` ON `driver_career_progression` (`driver_id`,`race_number`);--> statement-breakpoint
CREATE TABLE `driver_standings` (
	`race_number` integer NOT NULL,
	`driver_id` integer NOT NULL,
	`team_id` integer,
	`position` integer,
	`points` real NOT NULL,
	`win_count` integer NOT NULL,
	`highest_finish` integer,
	`is_eligible` integer NOT NULL,
	`adjustment_type` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`race_number`, `driver_id`),
	FOREIGN KEY (`race_number`) REFERENCES `races`(`race_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_driver_standings_race` ON `driver_standings` (`race_number`,`position`);--> statement-breakpoint
CREATE INDEX `idx_driver_standings_driver` ON `driver_standings` (`driver_id`,`race_number`);--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`jolpica_id` integer NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`forename` text NOT NULL,
	`surname` text NOT NULL,
	`full_name` text NOT NULL,
	`abbreviation` text,
	`permanent_car_number` integer,
	`country_code` text,
	`nationality` text,
	`date_of_birth` text,
	`reference` text,
	`wikipedia` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drivers_slug_unique` ON `drivers` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `drivers_jolpica_id_unique` ON `drivers` (`jolpica_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `drivers_jolpica_api_id_unique` ON `drivers` (`jolpica_api_id`);--> statement-breakpoint
CREATE TABLE `point_systems` (
	`id` integer PRIMARY KEY NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`name` text NOT NULL,
	`reference` text,
	`partial` integer DEFAULT 0 NOT NULL,
	`driver_position_points` text,
	`driver_fastest_lap` real NOT NULL,
	`team_position_points` text,
	`team_fastest_lap` real NOT NULL,
	`is_double_points` integer DEFAULT 0 NOT NULL,
	`shared_drive` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_systems_jolpica_api_id_unique` ON `point_systems` (`jolpica_api_id`);--> statement-breakpoint
CREATE TABLE `qualifying_results` (
	`race_number` integer NOT NULL,
	`driver_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`position` integer,
	`q1_time` text,
	`q2_time` text,
	`q3_time` text,
	`qualifying_time` text,
	`knocked_out_in` text,
	PRIMARY KEY(`race_number`, `driver_id`),
	FOREIGN KEY (`race_number`) REFERENCES `races`(`race_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_qualifying_results_driver` ON `qualifying_results` (`driver_id`);--> statement-breakpoint
CREATE TABLE `race_results` (
	`race_number` integer NOT NULL,
	`driver_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`car_number` integer,
	`grid` integer,
	`position` integer,
	`status` integer,
	`detail` text,
	`time` text,
	`laps_completed` integer,
	`points` real,
	`is_classified` integer,
	`fastest_lap_rank` integer,
	`pit_stop_count` integer,
	PRIMARY KEY(`race_number`, `driver_id`),
	FOREIGN KEY (`race_number`) REFERENCES `races`(`race_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_race_results_team` ON `race_results` (`team_id`,`race_number`);--> statement-breakpoint
CREATE INDEX `idx_race_results_driver` ON `race_results` (`driver_id`,`race_number`);--> statement-breakpoint
CREATE TABLE `races` (
	`race_number` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`jolpica_id` integer NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`season` integer NOT NULL,
	`round` integer NOT NULL,
	`circuit_id` integer NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`has_sprint` integer DEFAULT 0 NOT NULL,
	`prev_race_in_season` integer,
	`is_final_round` integer DEFAULT 0 NOT NULL,
	`wikipedia` text,
	FOREIGN KEY (`season`) REFERENCES `seasons`(`year`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`circuit_id`) REFERENCES `circuits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prev_race_in_season`) REFERENCES `races`(`race_number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `races_slug_unique` ON `races` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `races_jolpica_id_unique` ON `races` (`jolpica_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `races_jolpica_api_id_unique` ON `races` (`jolpica_api_id`);--> statement-breakpoint
CREATE INDEX `idx_races_season` ON `races` (`season`);--> statement-breakpoint
CREATE INDEX `idx_races_final` ON `races` (`is_final_round`);--> statement-breakpoint
CREATE UNIQUE INDEX `races_season_round_unique` ON `races` (`season`,`round`);--> statement-breakpoint
CREATE TABLE `round_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jolpica_id` integer NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`race_number` integer NOT NULL,
	`driver_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`car_number` integer,
	FOREIGN KEY (`race_number`) REFERENCES `races`(`race_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `round_entries_jolpica_id_unique` ON `round_entries` (`jolpica_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `round_entries_jolpica_api_id_unique` ON `round_entries` (`jolpica_api_id`);--> statement-breakpoint
CREATE INDEX `idx_round_entries_driver` ON `round_entries` (`driver_id`);--> statement-breakpoint
CREATE INDEX `idx_round_entries_race` ON `round_entries` (`race_number`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`year` integer PRIMARY KEY NOT NULL,
	`jolpica_id` integer NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`championship_system_id` integer,
	`wikipedia` text,
	FOREIGN KEY (`championship_system_id`) REFERENCES `championship_systems`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_jolpica_id_unique` ON `seasons` (`jolpica_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_jolpica_api_id_unique` ON `seasons` (`jolpica_api_id`);--> statement-breakpoint
CREATE TABLE `session_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jolpica_id` integer NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`session_id` integer NOT NULL,
	`round_entry_id` integer NOT NULL,
	`grid` integer,
	`position` integer,
	`laps_completed` integer,
	`status` integer,
	`detail` text,
	`time` text,
	`points` real,
	`is_classified` integer,
	`is_eligible_for_points` integer,
	`fastest_lap_rank` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`round_entry_id`) REFERENCES `round_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_entries_jolpica_id_unique` ON `session_entries` (`jolpica_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_entries_jolpica_api_id_unique` ON `session_entries` (`jolpica_api_id`);--> statement-breakpoint
CREATE INDEX `idx_session_entries_round_entry` ON `session_entries` (`round_entry_id`);--> statement-breakpoint
CREATE INDEX `idx_session_entries_session` ON `session_entries` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_entries_session_round_entry_unique` ON `session_entries` (`session_id`,`round_entry_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jolpica_id` integer NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`race_number` integer NOT NULL,
	`type` text NOT NULL,
	`number` integer,
	`point_system_id` integer,
	`scheduled_laps` integer,
	`timestamp` text,
	`timezone` text,
	`has_time_data` integer DEFAULT 0 NOT NULL,
	`is_cancelled` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`race_number`) REFERENCES `races`(`race_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`point_system_id`) REFERENCES `point_systems`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_jolpica_id_unique` ON `sessions` (`jolpica_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_jolpica_api_id_unique` ON `sessions` (`jolpica_api_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_race` ON `sessions` (`race_number`,`type`);--> statement-breakpoint
CREATE TABLE `sprint_qualifying_results` (
	`race_number` integer NOT NULL,
	`driver_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`position` integer,
	`sq1_time` text,
	`sq2_time` text,
	`sq3_time` text,
	`knocked_out_in` text,
	PRIMARY KEY(`race_number`, `driver_id`),
	FOREIGN KEY (`race_number`) REFERENCES `races`(`race_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sprint_results` (
	`race_number` integer NOT NULL,
	`driver_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`car_number` integer,
	`grid` integer,
	`position` integer,
	`status` integer,
	`detail` text,
	`time` text,
	`laps_completed` integer,
	`points` real,
	`is_classified` integer,
	`fastest_lap_rank` integer,
	`pit_stop_count` integer,
	PRIMARY KEY(`race_number`, `driver_id`),
	FOREIGN KEY (`race_number`) REFERENCES `races`(`race_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sprint_results_driver` ON `sprint_results` (`driver_id`);--> statement-breakpoint
CREATE TABLE `team_standings` (
	`race_number` integer NOT NULL,
	`team_id` integer NOT NULL,
	`position` integer,
	`points` real NOT NULL,
	`win_count` integer NOT NULL,
	`highest_finish` integer,
	`is_eligible` integer NOT NULL,
	`adjustment_type` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`race_number`, `team_id`),
	FOREIGN KEY (`race_number`) REFERENCES `races`(`race_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_team_standings_race` ON `team_standings` (`race_number`,`position`);--> statement-breakpoint
CREATE INDEX `idx_team_standings_team` ON `team_standings` (`team_id`,`race_number`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`jolpica_id` integer NOT NULL,
	`jolpica_api_id` text NOT NULL,
	`base_team_id` integer,
	`name` text NOT NULL,
	`country_code` text,
	`nationality` text,
	`primary_color` text,
	`reference` text,
	`wikipedia` text,
	FOREIGN KEY (`base_team_id`) REFERENCES `base_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_slug_unique` ON `teams` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_jolpica_id_unique` ON `teams` (`jolpica_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_jolpica_api_id_unique` ON `teams` (`jolpica_api_id`);