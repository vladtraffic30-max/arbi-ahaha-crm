CREATE TABLE `crm_records` (
	`id` text PRIMARY KEY NOT NULL,
	`record_type` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_by` text DEFAULT 'system' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_records_type_idx` ON `crm_records` (`record_type`);--> statement-breakpoint
CREATE TABLE `crm_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT 'system' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
