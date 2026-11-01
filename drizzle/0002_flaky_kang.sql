ALTER TABLE `stock_transactions` ADD `stockSource` varchar(32);--> statement-breakpoint
ALTER TABLE `stock_transactions` ADD `remark` text;--> statement-breakpoint
ALTER TABLE `stock_transactions` ADD `transferId` varchar(36);--> statement-breakpoint
ALTER TABLE `stock_transactions` ADD `relatedSku` varchar(255);