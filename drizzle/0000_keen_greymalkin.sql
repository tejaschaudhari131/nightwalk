CREATE TABLE `walks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`state` text NOT NULL,
	`expires` integer NOT NULL,
	`next_due` integer
);
--> statement-breakpoint
CREATE INDEX `walk_owner` ON `walks` (`owner`);--> statement-breakpoint
CREATE INDEX `walk_due` ON `walks` (`next_due`);--> statement-breakpoint
CREATE INDEX `walk_expiry` ON `walks` (`expires`);