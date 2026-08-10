CREATE TABLE `designer_preferences` (
	`owner_key` text PRIMARY KEY NOT NULL,
	`preferences_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
