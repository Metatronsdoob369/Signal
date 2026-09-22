CREATE TABLE "visits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "page_id" uuid NOT NULL,
  "client_visit_id" text NOT NULL,
  "path" text NOT NULL,
  "referrer_host" text DEFAULT '' NOT NULL,
  "referrer_class" text DEFAULT 'other' NOT NULL,
  "device_class" text DEFAULT 'desktop' NOT NULL,
  "lcp" integer,
  "inp" integer,
  "cls" numeric(6, 3),
  "engagement" numeric(6, 3),
  "contact_mailto" integer DEFAULT 0 NOT NULL,
  "contact_tel" integer DEFAULT 0 NOT NULL,
  "contact_form" integer DEFAULT 0 NOT NULL,
  "contact_goal" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "visits_site_visit_unique" UNIQUE("site_id", "client_visit_id")
);
--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "visit_rollups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "page_id" uuid NOT NULL,
  "day" date NOT NULL,
  "visits" integer DEFAULT 0 NOT NULL,
  "contacts" integer DEFAULT 0 NOT NULL,
  "mailto" integer DEFAULT 0 NOT NULL,
  "tel" integer DEFAULT 0 NOT NULL,
  "form" integer DEFAULT 0 NOT NULL,
  "goal" integer DEFAULT 0 NOT NULL,
  "lcp_p75" integer,
  "inp_p75" integer,
  "cls_p75" numeric(6, 3),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "visit_rollups_page_day_unique" UNIQUE("page_id", "day")
);
--> statement-breakpoint
ALTER TABLE "visit_rollups" ADD CONSTRAINT "visit_rollups_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "visit_rollups" ADD CONSTRAINT "visit_rollups_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;

