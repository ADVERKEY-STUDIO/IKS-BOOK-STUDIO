CREATE TABLE `book_project_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_key` text NOT NULL,
	`label` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `book_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_versions_project_created_idx` ON `book_project_versions` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `book_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`title` text NOT NULL,
	`source_name` text NOT NULL,
	`data_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `book_projects_owner_updated_idx` ON `book_projects` (`owner_key`,`updated_at`);