ALTER TABLE "sites" ADD COLUMN "public_key" text;--> statement-breakpoint
UPDATE "sites" SET "public_key" = gen_random_uuid()::text WHERE "public_key" IS NULL;--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "public_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_public_key_unique" UNIQUE("public_key");
