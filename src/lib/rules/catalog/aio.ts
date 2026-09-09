import { retrievalAccessSummary } from "@/lib/crawl/facts";
import { hasPageType } from "../derive";
import { fail, info, na, pass, type Rule } from "../types";

const AI_VISIBILITY = ["searchfit-seo:ai-visibility"] as const;
const SCHEMA = ["searchfit-seo:schema-markup", "searchfit-seo:ai-visibility"] as const;
const CONTENT = ["searchfit-seo:ai-visibility", "searchfit-seo:on-page-seo", "searchfit-seo:content-brief"] as const;
const TECHNICAL = ["searchfit-seo:technical-seo", "searchfit-seo:ai-visibility"] as const;

const LONG_FORM = 500;

export const AIO_RULES: readonly Rule[] = [
  // ── crawl: can AI systems reach the page at all? (site-level facts) ──
  {
    id: "aio.crawl.retrieval-bots",
    pillar: "aio",
    dimension: "crawl",
    weight: 5,
    severity: "critical",
    title: "AI Retrieval Bots Blocked",
    provenance: TECHNICAL,
    evaluate: ({ crawl }) => {
      const summary = retrievalAccessSummary(crawl);
      if (!summary) return na();
      if (!summary.blocked.length) return pass();
      const names = summary.blocked.map((bot) => bot.token).join(", ");
      return fail(
        `robots.txt disallows ${names} at the site root. These agents fetch or index pages for AI answers, so the site cannot be cited by them.`,
        "Allow retrieval agents in robots.txt. Keep training crawlers blocked if that is the policy; they are separate tokens.",
      );
    },
  },
  {
    id: "aio.crawl.training-policy",
    pillar: "aio",
    dimension: "crawl",
    weight: 0,
    severity: "info",
    title: "Training Crawlers Disallowed",
    provenance: AI_VISIBILITY,
    evaluate: ({ crawl }) => {
      const summary = retrievalAccessSummary(crawl);
      if (!summary || !summary.trainersBlocked.length) return na();
      const names = summary.trainersBlocked.map((bot) => bot.token).join(", ");
      return info(
        `robots.txt disallows ${names}. This is a training opt-out; it does not affect retrieval-time AI visibility and is not scored.`,
      );
    },
  },
  {
    id: "aio.crawl.facts-unknown",
    pillar: "aio",
    dimension: "crawl",
    weight: 0,
    severity: "info",
    title: "AI Crawler Access Not Yet Checked",
    provenance: TECHNICAL,
    evaluate: ({ crawl }) =>
      crawl && crawl.robots.status !== "error"
        ? na()
        : info("Signal has not read this site's robots.txt yet, or the fetch failed. The crawl dimension is excluded until it succeeds."),
  },
  {
    id: "aio.crawl.robots-present",
    pillar: "aio",
    dimension: "crawl",
    weight: 1,
    severity: "info",
    title: "No robots.txt",
    provenance: TECHNICAL,
    evaluate: ({ crawl }) => {
      if (!crawl || crawl.robots.status === "error") return na();
      return crawl.robots.status === "ok"
        ? pass()
        : fail("The site has no robots.txt. Crawlers default to allow, but you have no place to declare a sitemap or per-agent policy.", "Publish /robots.txt with a Sitemap line.");
    },
  },
  {
    id: "aio.crawl.sitemap-declared",
    pillar: "aio",
    dimension: "crawl",
    weight: 1,
    severity: "info",
    title: "Sitemap Not Declared",
    provenance: TECHNICAL,
    evaluate: ({ crawl }) => {
      if (!crawl || crawl.robots.status !== "ok") return na();
      return crawl.robots.sitemapDeclared
        ? pass()
        : fail("robots.txt does not declare a sitemap.", "Add `Sitemap: https://<host>/sitemap.xml` to robots.txt.");
    },
  },
  {
    id: "aio.crawl.llms-txt",
    pillar: "aio",
    dimension: "crawl",
    weight: 1,
    severity: "info",
    title: "No llms.txt",
    provenance: AI_VISIBILITY,
    evaluate: ({ crawl }) => {
      if (!crawl || crawl.llmsTxt.status === "error") return na();
      return crawl.llmsTxt.status === "ok"
        ? pass()
        : fail("No /llms.txt found. It is an emerging convention that hands AI agents a curated map of the site.", "Publish /llms.txt listing the pages you want models to read first.");
    },
  },
  {
    id: "aio.crawl.snippets",
    pillar: "aio",
    dimension: "crawl",
    weight: 3,
    severity: "warning",
    title: "Snippets Suppressed",
    provenance: TECHNICAL,
    evaluate: ({ derived }) => {
      const meta = derived.robotsMeta;
      if (meta.nosnippet || meta.maxSnippetZero) {
        return fail("The robots meta tag suppresses snippets, so answer engines cannot quote this page.", "Remove nosnippet / max-snippet:0 unless quoting must be prevented.");
      }
      if (meta.noai) return fail("The robots meta tag carries a noai directive.", "Remove noai if you want AI systems to use this page.");
      return pass();
    },
  },

  // ── structure: does the page describe itself in machine-readable form? ──
  {
    id: "aio.schema.present",
    pillar: "aio",
    dimension: "structure",
    weight: 5,
    severity: "critical",
    title: "No Structured Data",
    provenance: SCHEMA,
    evaluate: ({ payload }) =>
      payload.aio.hasStructuredData || payload.aio.schemaNodes.length
        ? pass()
        : fail("The page has no JSON-LD structured data.", "Add JSON-LD for the page type (Article, Product, FAQPage, HowTo, Organization)."),
  },
  {
    id: "aio.schema.valid-json",
    pillar: "aio",
    dimension: "structure",
    weight: 3,
    severity: "warning",
    title: "Structured Data Fails to Parse",
    provenance: SCHEMA,
    evaluate: ({ payload }) => {
      if (!payload.aio.structuredDataCount && !payload.aio.schemaParseErrors) return na();
      const errors = payload.aio.schemaParseErrors;
      return errors === 0
        ? pass()
        : fail(`${errors} JSON-LD block${errors === 1 ? "" : "s"} are not valid JSON.`, "Validate the JSON-LD; a single trailing comma discards the whole block.");
    },
  },
  {
    id: "aio.schema.page-type",
    pillar: "aio",
    dimension: "structure",
    weight: 3,
    severity: "warning",
    title: "No Page-Type Schema",
    provenance: SCHEMA,
    evaluate: ({ derived }) => {
      if (!derived.schema.types.size) return na();
      return hasPageType(derived.schema.types)
        ? pass()
        : fail("Structured data is present but none of it declares what kind of page this is.", "Add an Article, Product, FAQPage, HowTo, Service, or WebPage node.");
    },
  },
  {
    id: "aio.schema.entity",
    pillar: "aio",
    dimension: "structure",
    weight: 3,
    severity: "warning",
    title: "No Organization or Person Entity",
    provenance: SCHEMA,
    evaluate: ({ derived }) =>
      derived.schema.entityNode
        ? pass()
        : fail("No Organization, Person, or WebSite node tells models who stands behind this page.", "Add an Organization (or Person) node with name, url, and logo."),
  },
  {
    id: "aio.schema.same-as",
    pillar: "aio",
    dimension: "structure",
    weight: 2,
    severity: "info",
    title: "Entity Lacks sameAs",
    provenance: AI_VISIBILITY,
    evaluate: ({ derived }) => {
      if (!derived.schema.entityNode || !derived.schema.nodes.length) return na();
      return derived.schema.sameAs
        ? pass()
        : fail("The entity node has no sameAs links, so models cannot reconcile it with your other web properties.", "Add sameAs with your official profiles and directory listings.");
    },
  },
  {
    id: "aio.schema.completeness",
    pillar: "aio",
    dimension: "structure",
    weight: 3,
    severity: "warning",
    title: "Structured Data Missing Required Properties",
    provenance: SCHEMA,
    evaluate: ({ derived }) => {
      const { known, complete, missing } = derived.schema;
      if (!known) return na();
      if (complete === known) return pass();
      const detail = missing.map((m) => `${m.type}: ${m.keys.join(", ")}`).join("; ");
      return fail(`${known - complete} of ${known} typed nodes lack required properties (${detail}).`, "Populate the required properties for each schema type.");
    },
  },
  {
    id: "aio.schema.faq-for-questions",
    pillar: "aio",
    dimension: "structure",
    weight: 2,
    severity: "warning",
    title: "Questions Without FAQ Schema",
    provenance: SCHEMA,
    evaluate: ({ payload }) => {
      if (payload.content.questionHeadingCount < 2) return na();
      return payload.aio.hasFAQ
        ? pass()
        : fail(`The page poses ${payload.content.questionHeadingCount} questions as headings but declares no FAQPage schema.`, "Mark the Q&A pairs up as FAQPage mainEntity items.");
    },
  },
  {
    id: "aio.schema.dates",
    pillar: "aio",
    dimension: "structure",
    weight: 2,
    severity: "info",
    title: "Article Schema Without Dates",
    provenance: SCHEMA,
    evaluate: ({ payload, derived }) => {
      if (!derived.articleLike) return na();
      const dated = derived.schema.hasDates || payload.metadata.publishedTime || payload.metadata.modifiedTime;
      return dated
        ? pass()
        : fail("The article declares no datePublished or dateModified.", "Add both dates; freshness is a citation signal.");
    },
  },

  // ── extractability: can a model lift a clean answer out of the page? ──
  {
    id: "aio.answer.question-headings",
    pillar: "aio",
    dimension: "extractability",
    weight: 2,
    severity: "info",
    title: "No Question-Form Headings",
    provenance: CONTENT,
    evaluate: ({ payload }) => {
      if (payload.content.wordCount < 300) return na();
      return payload.content.questionHeadingCount > 0
        ? pass()
        : fail("No heading is phrased as a question, so the page does not match how people ask AI assistants.", "Turn at least one H2 into the question the section answers.");
    },
  },
  {
    id: "aio.answer.answer-first",
    pillar: "aio",
    dimension: "extractability",
    weight: 4,
    severity: "warning",
    title: "Questions Not Answered Directly",
    provenance: CONTENT,
    evaluate: ({ derived }) => {
      const ratio = derived.answerFirstRatio;
      if (ratio === null) return na();
      return ratio >= 0.6
        ? pass()
        : fail(`Only ${Math.round(ratio * 100)}% of question headings are followed by a direct 15–80 word answer.`, "Open each question section with a one-paragraph answer before elaborating.");
    },
  },
  {
    id: "aio.answer.definitions",
    pillar: "aio",
    dimension: "extractability",
    weight: 3,
    severity: "warning",
    title: "No Definitional Sentences",
    provenance: CONTENT,
    evaluate: ({ payload }) => {
      if (payload.content.wordCount < 300) return na();
      const count = payload.content.definitionSentenceCount || (payload.aio.hasClearDefinitions ? 1 : 0);
      return count > 0
        ? pass()
        : fail("The page never states what its subject is in a definitional sentence.", 'Add a sentence shaped like "<Term> is a <category> that <does>".');
    },
  },
  {
    id: "aio.answer.sentence-length",
    pillar: "aio",
    dimension: "extractability",
    weight: 2,
    severity: "warning",
    title: "Long Sentences",
    provenance: CONTENT,
    evaluate: ({ payload }) => {
      const avg = payload.aio.avgSentenceLength;
      if (!avg) return na();
      return avg <= 25 ? pass() : fail(`Average sentence length is ${avg} words.`, "Aim for 15–20 words per sentence.");
    },
  },
  {
    id: "aio.answer.paragraph-length",
    pillar: "aio",
    dimension: "extractability",
    weight: 2,
    severity: "info",
    title: "Long Paragraphs",
    provenance: CONTENT,
    evaluate: ({ payload }) => {
      const avg = payload.content.avgParagraphWords;
      if (!avg) return na();
      return avg <= 120 ? pass() : fail(`Paragraphs average ${Math.round(avg)} words.`, "Break paragraphs at one idea each; under 120 words.");
    },
  },
  {
    id: "aio.answer.lists-tables",
    pillar: "aio",
    dimension: "extractability",
    weight: 2,
    severity: "info",
    title: "No Lists or Tables",
    provenance: CONTENT,
    evaluate: ({ payload }) => {
      if (payload.content.wordCount < LONG_FORM) return na();
      return payload.content.listCount + payload.content.tableCount > 0
        ? pass()
        : fail("Long-form content with no lists or tables gives models nothing to extract as a unit.", "Present comparisons, steps, and specs as lists or tables.");
    },
  },
  {
    id: "aio.answer.summary-block",
    pillar: "aio",
    dimension: "extractability",
    weight: 1,
    severity: "info",
    title: "No Summary Block",
    provenance: CONTENT,
    evaluate: ({ payload }) => {
      if (payload.content.wordCount < 800) return na();
      return payload.content.hasSummaryBlock
        ? pass()
        : fail("A page this long has no summary or key-takeaways section.", 'Add a short "Key takeaways" or "In short" block near the top.');
    },
  },
  {
    id: "aio.answer.heading-density",
    pillar: "aio",
    dimension: "extractability",
    weight: 2,
    severity: "info",
    title: "Sparse Headings",
    provenance: CONTENT,
    evaluate: ({ payload, derived }) => {
      if (payload.content.wordCount < 600 || derived.headingsPer300Words === null) return na();
      return derived.headingsPer300Words >= 1
        ? pass()
        : fail("Fewer than one subheading per 300 words; sections are too long to chunk cleanly.", "Add an H2 or H3 roughly every 300 words.");
    },
  },

  // ── entity: who wrote this, when, and on what basis? ──
  {
    id: "aio.entity.author",
    pillar: "aio",
    dimension: "entity",
    weight: 2,
    severity: "info",
    title: "No Author Signal",
    provenance: ["searchfit-seo:on-page-seo", "searchfit-seo:ai-visibility"],
    evaluate: ({ payload, derived }) => {
      if (payload.content.wordCount < LONG_FORM) return na();
      const signal = payload.content.hasByline || payload.metadata.author || derived.schema.hasAuthor;
      return signal
        ? pass()
        : fail("Long-form content with no visible author, author meta, or schema author.", "Add a byline and an author property in the Article schema.");
    },
  },
  {
    id: "aio.entity.dates",
    pillar: "aio",
    dimension: "entity",
    weight: 2,
    severity: "info",
    title: "No Publication Date",
    provenance: ["searchfit-seo:schema-markup", "searchfit-seo:ai-visibility"],
    evaluate: ({ payload, derived }) => {
      if (payload.content.wordCount < LONG_FORM) return na();
      const dated =
        payload.metadata.publishedTime ||
        payload.metadata.modifiedTime ||
        payload.content.timeElementCount > 0 ||
        derived.schema.hasDates;
      return dated
        ? pass()
        : fail("No publish or modified date is exposed anywhere on the page.", "Add a <time datetime> element and article:published_time / article:modified_time.");
    },
  },
  {
    id: "aio.entity.citations",
    pillar: "aio",
    dimension: "entity",
    weight: 2,
    severity: "info",
    title: "No Outbound Citations",
    provenance: ["searchfit-seo:content-brief", "searchfit-seo:ai-visibility"],
    evaluate: ({ payload }) => {
      if (payload.content.wordCount < LONG_FORM) return na();
      return payload.content.externalLinksCount > 0
        ? pass()
        : fail("Long-form content that cites no external source reads as unsupported to a model.", "Link claims and statistics to their primary sources.");
    },
  },
  {
    id: "aio.entity.language",
    pillar: "aio",
    dimension: "entity",
    weight: 1,
    severity: "info",
    title: "Document Language Undeclared",
    provenance: TECHNICAL,
    evaluate: ({ payload }) =>
      payload.structure.hasHtmlLang
        ? pass()
        : fail("The html element has no lang attribute.", 'Add lang="en" (or the correct language) to <html>.'),
  },

  // ── consistency: do the page's own signals agree with each other? ──
  {
    id: "aio.consistency.title-h1",
    pillar: "aio",
    dimension: "consistency",
    weight: 2,
    severity: "warning",
    title: "Title and H1 Disagree",
    provenance: ["searchfit-seo:on-page-seo"],
    evaluate: ({ derived }) => {
      if (derived.titleH1Overlap === null) return na();
      return derived.titleH1Overlap >= 0.3
        ? pass()
        : fail("The title tag and the H1 share almost no vocabulary, which reads as two different topics.", "Align the H1 with the title's core terms.");
    },
  },
  {
    id: "aio.consistency.title-og",
    pillar: "aio",
    dimension: "consistency",
    weight: 2,
    severity: "warning",
    title: "Title and og:title Disagree",
    provenance: ["searchfit-seo:on-page-seo"],
    evaluate: ({ derived }) => {
      if (derived.titleOgOverlap === null) return na();
      return derived.titleOgOverlap >= 0.6
        ? pass()
        : fail("og:title diverges from the title tag.", "Keep og:title within the title's vocabulary.");
    },
  },
  {
    id: "aio.consistency.description-og",
    pillar: "aio",
    dimension: "consistency",
    weight: 1,
    severity: "info",
    title: "Description and og:description Disagree",
    provenance: ["searchfit-seo:on-page-seo"],
    evaluate: ({ derived }) => {
      if (derived.descriptionOgOverlap === null) return na();
      return derived.descriptionOgOverlap >= 0.5
        ? pass()
        : fail("og:description diverges from the meta description.", "Use one description across meta and Open Graph unless the social copy is deliberately different.");
    },
  },
];
