ALTER TABLE "audits" ADD COLUMN "aio_dimensions" jsonb;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "rule_id" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "crawl_facts" jsonb;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "crawl_facts_at" timestamp with time zone;