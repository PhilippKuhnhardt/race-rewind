CREATE TABLE `team_career_progression` (
	`team_id` integer NOT NULL,
	`race_number` integer NOT NULL,
	`cum_entries` integer NOT NULL,
	`cum_wins` integer NOT NULL,
	`cum_podiums` integer NOT NULL,
	`cum_poles` integer NOT NULL,
	`cum_fastest_laps` integer NOT NULL,
	`cum_points` real NOT NULL,
	`cum_championships` integer NOT NULL,
	`cum_drivers_fielded` integer NOT NULL,
	PRIMARY KEY(`team_id`, `race_number`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`race_number`) REFERENCES `races`(`race_number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_team_career_race` ON `team_career_progression` (`race_number`);--> statement-breakpoint
CREATE INDEX `idx_team_career_team` ON `team_career_progression` (`team_id`,`race_number`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_races` (
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
	FOREIGN KEY (`circuit_id`) REFERENCES `circuits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_races`("race_number", "slug", "jolpica_id", "jolpica_api_id", "season", "round", "circuit_id", "name", "date", "has_sprint", "prev_race_in_season", "is_final_round", "wikipedia") SELECT "race_number", "slug", "jolpica_id", "jolpica_api_id", "season", "round", "circuit_id", "name", "date", "has_sprint", "prev_race_in_season", "is_final_round", "wikipedia" FROM `races`;--> statement-breakpoint
DROP TABLE `races`;--> statement-breakpoint
ALTER TABLE `__new_races` RENAME TO `races`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `races_slug_unique` ON `races` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `races_jolpica_id_unique` ON `races` (`jolpica_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `races_jolpica_api_id_unique` ON `races` (`jolpica_api_id`);--> statement-breakpoint
CREATE INDEX `idx_races_season` ON `races` (`season`);--> statement-breakpoint
CREATE INDEX `idx_races_final` ON `races` (`is_final_round`);--> statement-breakpoint
CREATE UNIQUE INDEX `races_season_round_unique` ON `races` (`season`,`round`);