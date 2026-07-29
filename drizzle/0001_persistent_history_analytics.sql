CREATE TABLE IF NOT EXISTS `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text,
	`source_url` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`conversation_id` text NOT NULL,
	`turn_id` text NOT NULL,
	`mime_type` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `assets` ADD `role` text DEFAULT 'output' NOT NULL;
--> statement-breakpoint
ALTER TABLE `assets` ADD `slot_index` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversations_user_idx` ON `conversations` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `conversation_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversation_turns_idx` ON `conversation_turns` (`user_id`,`conversation_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_name` text NOT NULL,
	`mode` text,
	`skill` text,
	`conversation_id` text,
	`turn_id` text,
	`metadata_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `analytics_events_date_idx` ON `analytics_events` (`created_at`);
--> statement-breakpoint
CREATE INDEX `analytics_events_user_idx` ON `analytics_events` (`user_id`,`created_at`);
