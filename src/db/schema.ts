import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  date,
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

// Visitor telemetry — Phase 1
export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .references(() => sites.id)
      .notNull(),
    pageId: uuid("page_id")
      .references(() => pages.id)
      .notNull(),
    /** Client-generated visit identifier to stitch unload updates (not a cookie, per-visit only). */
    clientVisitId: text("client_visit_id").notNull(),
    path: text("path").notNull(),
    /** Reduced client-side to a hostname without www; empty string means direct. */
    referrerHost: text("referrer_host").default("").notNull(),
    /** Classified server-side from referrerHost: ai|search|social|direct|other. */
    referrerClass: text("referrer_class").default("other").notNull(),
    /** mobile|tablet|desktop */
    deviceClass: text("device_class").default("desktop").notNull(),
    /** Web Vitals in milliseconds; cls is unitless. All optional. */
    lcp: integer("lcp"),
    inp: integer("inp"),
    cls: numeric("cls", { precision: 6, scale: 3 }),
    /** 0..1 engagement score sent on unload; null if not observed. */
    engagement: numeric("engagement", { precision: 6, scale: 3 }),
    contactMailto: integer("contact_mailto").default(0).notNull(),
    contactTel: integer("contact_tel").default(0).notNull(),
    contactForm: integer("contact_form").default(0).notNull(),
    contactGoal: integer("contact_goal").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("visits_site_visit_unique").on(table.siteId, table.clientVisitId)],
);

export const visitRollups = pgTable(
  "visit_rollups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .references(() => sites.id)
      .notNull(),
    pageId: uuid("page_id")
      .references(() => pages.id)
      .notNull(),
    /** UTC day bucket for the page. */
    day: date("day").notNull(),
    visits: integer("visits").default(0).notNull(),
    contacts: integer("contacts").default(0).notNull(),
    mailto: integer("mailto").default(0).notNull(),
    tel: integer("tel").default(0).notNull(),
    form: integer("form").default(0).notNull(),
    goal: integer("goal").default(0).notNull(),
    /** p75 vitals for the day (milliseconds for lcp/inp, unitless for cls). */
    lcpP75: integer("lcp_p75"),
    inpP75: integer("inp_p75"),
    clsP75: numeric("cls_p75", { precision: 6, scale: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("visit_rollups_page_day_unique").on(table.pageId, table.day)],
);
