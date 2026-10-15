CREATE TABLE `chapter_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`class_key` varchar(16) NOT NULL,
	`subject` varchar(100) NOT NULL,
	`book_title` varchar(180) NOT NULL,
	`chapter` varchar(180) NOT NULL,
	`markdown` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chapter_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `chapter_notes_canonical_idx` UNIQUE(`class_key`,`subject`,`book_title`,`chapter`)
);
--> statement-breakpoint
CREATE TABLE `current_affairs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_date` varchar(10) NOT NULL,
	`topic` varchar(100) NOT NULL,
	`title` varchar(180) NOT NULL,
	`summary` text NOT NULL,
	`source_title` varchar(220) NOT NULL,
	`source_url` varchar(2048) NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `current_affairs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`redeemed_at` timestamp,
	`redeemed_by` int,
	`revoked_at` timestamp,
	CONSTRAINT `teacher_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_invites_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `teacher_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`object_key` varchar(512) NOT NULL,
	`title` varchar(180) NOT NULL,
	`class_key` varchar(16) NOT NULL,
	`subject` varchar(100) NOT NULL,
	`chapter` varchar(180) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`byte_size` int NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`uploaded_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_uploads_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_uploads_object_key_unique` UNIQUE(`object_key`)
);
--> statement-breakpoint
CREATE TABLE `upload_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`object_key` varchar(512) NOT NULL,
	`uploaded_by` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`class_key` varchar(16) NOT NULL,
	`subject` varchar(100) NOT NULL,
	`chapter` varchar(180) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`byte_size` int NOT NULL,
	`expires_at` timestamp NOT NULL,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `upload_reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `upload_reservations_object_key_unique` UNIQUE(`object_key`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','teacher','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `current_affairs` ADD CONSTRAINT `current_affairs_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_invites` ADD CONSTRAINT `teacher_invites_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_invites` ADD CONSTRAINT `teacher_invites_redeemed_by_users_id_fk` FOREIGN KEY (`redeemed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_uploads` ADD CONSTRAINT `teacher_uploads_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `upload_reservations` ADD CONSTRAINT `upload_reservations_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `chapter_notes_updated_idx` ON `chapter_notes` (`updated_at`);--> statement-breakpoint
CREATE INDEX `current_affairs_status_date_idx` ON `current_affairs` (`status`,`event_date`);--> statement-breakpoint
CREATE INDEX `current_affairs_created_by_idx` ON `current_affairs` (`created_by`);--> statement-breakpoint
CREATE INDEX `teacher_invites_created_by_idx` ON `teacher_invites` (`created_by`);--> statement-breakpoint
CREATE INDEX `teacher_uploads_status_created_idx` ON `teacher_uploads` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `teacher_uploads_owner_status_idx` ON `teacher_uploads` (`uploaded_by`,`status`);--> statement-breakpoint
CREATE INDEX `upload_reservations_owner_idx` ON `upload_reservations` (`uploaded_by`,`created_at`);--> statement-breakpoint
CREATE INDEX `upload_reservations_expiry_idx` ON `upload_reservations` (`expires_at`);