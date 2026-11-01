CREATE TABLE IF NOT EXISTS `banana_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `banana_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `banana_reports_reportDate_unique` UNIQUE(`reportDate`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `banana_report_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`skuOrder` int NOT NULL,
	`skuName` varchar(255) NOT NULL,
	`logistics14` decimal(10,2) NOT NULL DEFAULT '0',
	`logistics15` decimal(10,2) NOT NULL DEFAULT '0',
	`logistics16` decimal(10,2) NOT NULL DEFAULT '0',
	`production14` decimal(10,2) NOT NULL DEFAULT '0',
	`production15` decimal(10,2) NOT NULL DEFAULT '0',
	`production16` decimal(10,2) NOT NULL DEFAULT '0',
	`additional14` decimal(10,2) NOT NULL DEFAULT '0',
	`additional15` decimal(10,2) NOT NULL DEFAULT '0',
	`additional16` decimal(10,2) NOT NULL DEFAULT '0',
	`doQty` decimal(10,2) NOT NULL DEFAULT '0',
	`remark` text,
	`rejectQty` decimal(10,2) NOT NULL DEFAULT '0',
	CONSTRAINT `banana_report_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `banana_report_items_reportId_banana_reports_id_fk` FOREIGN KEY (`reportId`) REFERENCES `banana_reports`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `stock_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`movementType` enum('in','out','reject') NOT NULL,
	`skuName` varchar(255) NOT NULL,
	`step` int NOT NULL,
	`qty` decimal(10,2) NOT NULL,
	`reason` varchar(64) NOT NULL DEFAULT 'stock produksi',
	`movedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `banana_report_items_report_id_idx` ON `banana_report_items` (`reportId`);
--> statement-breakpoint
CREATE INDEX `banana_reports_report_date_idx` ON `banana_reports` (`reportDate`);
--> statement-breakpoint
CREATE INDEX `stock_transactions_moved_at_idx` ON `stock_transactions` (`movedAt`);
--> statement-breakpoint
CREATE INDEX `stock_transactions_sku_step_idx` ON `stock_transactions` (`skuName`,`step`);
