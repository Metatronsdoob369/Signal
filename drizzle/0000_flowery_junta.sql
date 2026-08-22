CREATE TABLE "audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"url" text NOT NULL,
	"seo_score" numeric(5, 2) NOT NULL,
	"aio_score" numeric(5, 2) NOT NULL,
	"performance_score" numeric(5, 2),
	"accessibility_score" numeric(5, 2),
	"best_practices_score" numeric(5, 2),
	"overall_score" numeric(5, 2) NOT NULL,
	"title" text,
	"meta_description" text,
	"h1" text,
	"canonical" text,
	"word_count" integer DEFAULT 0 NOT NULL,
	"image_count" integer DEFAULT 0 NOT NULL,
	"images_without_alt" integer DEFAULT 0 NOT NULL,
	"structured_data_count" integer DEFAULT 0 NOT NULL,
	"has_faq" boolean DEFAULT false NOT NULL,
	"has_how_to" boolean DEFAULT false NOT NULL,
	"has_clear_definitions" boolean DEFAULT false NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"fix" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"name" text,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_audit_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"seo_score" numeric(5, 2),
	"aio_score" numeric(5, 2),
	"overall_score" numeric(5, 2),
	CONSTRAINT "sites_domain_unique" UNIQUE("domain"),
	CONSTRAINT "sites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE no action ON UPDATE no action;