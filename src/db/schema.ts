import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: text("domain").notNull().unique(),
  name: text("name"),
  tokenHash: text("token_hash").notNull().unique(),
  publicKey: text("public_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastAuditAt: timestamp("last_audit_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  /** Per-site switch for title/description experiments. Off by default: variants rewrite the client page's title. */
  experimentsEnabled: boolean("experiments_enabled").default(false).notNull(),
  seoScore: numeric("seo_score", { precision: 5, scale: 2 }),
  aioScore: numeric("aio_score", { precision: 5, scale: 2 }),
  overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
  crawlFacts: jsonb("crawl_facts"),
  crawlFactsAt: timestamp("crawl_facts_at", { withTimezone: true }),
});

export const audits = pgTable("audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .references(() => sites.id)
    .notNull(),
  url: text("url").notNull(),
  seoScore: numeric("seo_score", { precision: 5, scale: 2 }).notNull(),
  aioScore: numeric("aio_score", { precision: 5, scale: 2 }).notNull(),
  performanceScore: numeric("performance_score", { precision: 5, scale: 2 }),
  accessibilityScore: numeric("accessibility_score", { precision: 5, scale: 2 }),
  bestPracticesScore: numeric("best_practices_score", { precision: 5, scale: 2 }),
  overallScore: numeric("overall_score", { precision: 5, scale: 2 }).notNull(),
  title: text("title"),
  metaDescription: text("meta_description"),
  h1: text("h1"),
  canonical: text("canonical"),
  wordCount: integer("word_count").default(0).notNull(),
  imageCount: integer("image_count").default(0).notNull(),
  imagesWithoutAlt: integer("images_without_alt").default(0).notNull(),
  structuredDataCount: integer("structured_data_count").default(0).notNull(),
  hasFaq: boolean("has_faq").default(false).notNull(),
  hasHowTo: boolean("has_how_to").default(false).notNull(),
  hasClearDefinitions: boolean("has_clear_definitions").default(false).notNull(),
  questionCount: integer("question_count").default(0).notNull(),
  payload: jsonb("payload"),
  aioDimensions: jsonb("aio_dimensions"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditId: uuid("audit_id")
    .references(() => audits.id)
    .notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  fix: text("fix"),
  ruleId: text("rule_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .references(() => sites.id)
      .notNull(),
    path: text("path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("pages_site_id_path_unique").on(table.siteId, table.path)],
);

export const variants = pgTable("variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id")
    .references(() => pages.id)
    .notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const experimentEvents = pgTable("experiment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .references(() => sites.id)
    .notNull(),
  pageId: uuid("page_id")
    .references(() => pages.id)
    .notNull(),
  variantId: uuid("variant_id").references(() => variants.id),
  type: text("type").notNull(),
  metric: text("metric"),
  value: numeric("value", { precision: 12, scale: 4 }).default("0").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
