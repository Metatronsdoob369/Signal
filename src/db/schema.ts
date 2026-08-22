import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: text("domain").notNull().unique(),
  name: text("name"),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastAuditAt: timestamp("last_audit_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  seoScore: numeric("seo_score", { precision: 5, scale: 2 }),
  aioScore: numeric("aio_score", { precision: 5, scale: 2 }),
  overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
