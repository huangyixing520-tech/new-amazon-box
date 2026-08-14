ALTER TABLE `assets` ADD `generation_id` text;
--> statement-breakpoint
ALTER TABLE `analytics_events` ADD `generation_id` text;
--> statement-breakpoint
CREATE TABLE `generation_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`media_type` text NOT NULL,
	`skill` text,
	`prompt` text NOT NULL,
	`status` text NOT NULL,
	`slot_index` integer DEFAULT 0 NOT NULL,
	`asset_id` text,
	`error_message` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `generation_records_user_idx` ON `generation_records` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `generation_records_date_idx` ON `generation_records` (`created_at`);
