CREATE TABLE `asset_owners` (
	`asset_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `asset_owners_user_idx` ON `asset_owners` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `generation_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generation_tasks_user_idx` ON `generation_tasks` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_api_keys` (
	`user_id` text PRIMARY KEY NOT NULL,
	`encrypted_key` text NOT NULL,
	`key_last_four` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`picture_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
