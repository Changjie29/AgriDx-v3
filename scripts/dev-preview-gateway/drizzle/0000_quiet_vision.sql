CREATE TABLE `preview_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`question` text NOT NULL,
	`machine_type` text NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`outcome` text NOT NULL,
	`knowledge_chunks` integer NOT NULL,
	`latency_ms` integer NOT NULL,
	`release` text NOT NULL,
	FOREIGN KEY (`visitor_id`) REFERENCES `preview_visitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `preview_questions_time` ON `preview_questions` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `preview_questions_visitor` ON `preview_questions` (`visitor_id`);--> statement-breakpoint
CREATE TABLE `preview_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `preview_rate_limits_expiry` ON `preview_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `preview_admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`github_login` text NOT NULL,
	`github_id` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `preview_admin_sessions_expiry` ON `preview_admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `preview_visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`browser` text NOT NULL,
	`os` text NOT NULL,
	`device` text NOT NULL,
	`country` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `preview_visitors_last_seen` ON `preview_visitors` (`last_seen`);--> statement-breakpoint
CREATE TABLE `preview_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`path` text NOT NULL,
	`referrer` text NOT NULL,
	FOREIGN KEY (`visitor_id`) REFERENCES `preview_visitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `preview_visits_time` ON `preview_visits` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `preview_visits_visitor` ON `preview_visits` (`visitor_id`);