import { fail, na, pass, type Rule } from "../types";

const ON_PAGE = ["searchfit-seo:on-page-seo", "searchfit-seo:seo-audit"] as const;
const TECHNICAL = ["searchfit-seo:technical-seo", "searchfit-seo:seo-audit"] as const;
const LINKING = ["searchfit-seo:internal-linking", "searchfit-seo:on-page-seo"] as const;

export const SEO_RULES: readonly Rule[] = [
  {
    id: "seo.title.present",
    pillar: "seo",
    weight: 5,
    severity: "critical",
    title: "Missing Page Title",
    provenance: ON_PAGE,
    evaluate: ({ payload }) =>
      payload.metadata.title
        ? pass()
        : fail("The page does not have a title tag.", "Add a descriptive title tag of 50–60 characters."),
  },
  {
    id: "seo.title.length",
    pillar: "seo",
    weight: 2,
    severity: "warning",
    title: "Title Length",
    provenance: ON_PAGE,
    evaluate: ({ payload }) => {
      const length = payload.metadata.title.length;
      if (!length) return na();
      if (length < 30) return fail(`Title is ${length} characters.`, "Expand the title toward 50–60 characters.");
      if (length > 60) return fail(`Title is ${length} characters and will truncate.`, "Shorten the title to 60 characters or fewer.");
      return pass();
    },
  },
  {
    id: "seo.description.present",
    pillar: "seo",
    weight: 4,
    severity: "critical",
    title: "Missing Meta Description",
    provenance: ON_PAGE,
    evaluate: ({ payload }) =>
      payload.metadata.description
        ? pass()
        : fail("The page lacks a meta description.", "Add a meta description of 150–160 characters."),
  },
  {
    id: "seo.description.length",
    pillar: "seo",
    weight: 2,
    severity: "warning",
    title: "Meta Description Length",
    provenance: ON_PAGE,
    evaluate: ({ payload }) => {
      const length = payload.metadata.description.length;
      if (!length) return na();
      if (length < 100) return fail(`Description is ${length} characters.`, "Expand to 150–160 characters.");
      if (length > 160) return fail(`Description is ${length} characters and will truncate.`, "Trim to 160 characters or fewer.");
      return pass();
    },
  },
  {
    id: "seo.canonical.present",
    pillar: "seo",
    weight: 2,
    severity: "info",
    title: "Missing Canonical URL",
    provenance: TECHNICAL,
    evaluate: ({ payload }) =>
      payload.metadata.canonical
        ? pass()
        : fail("No canonical link tag found.", "Add a self-referencing canonical URL."),
  },
  {
    id: "seo.canonical.self",
    pillar: "seo",
    weight: 2,
    severity: "warning",
    title: "Canonical Points Elsewhere",
    provenance: TECHNICAL,
    evaluate: ({ derived }) => {
      if (derived.canonicalMatches === null) return na();
      return derived.canonicalMatches
        ? pass()
        : fail(
            "The canonical URL does not match this page, so search engines treat this URL as a duplicate.",
            "Point the canonical at this page unless the duplication is intentional.",
          );
    },
  },
  {
    id: "seo.h1.single",
    pillar: "seo",
    weight: 4,
    severity: "critical",
    title: "H1 Heading",
    provenance: ON_PAGE,
    evaluate: ({ payload }) => {
      const h1 = payload.content.headings.h1;
      if (h1 === 0) return fail("The page has no H1 heading.", "Add a single descriptive H1.");
      if (h1 > 1) return fail(`Found ${h1} H1 tags.`, "Use one H1 and H2–H6 for subheadings.");
      return pass();
    },
  },
  {
    id: "seo.headings.hierarchy",
    pillar: "seo",
    weight: 2,
    severity: "warning",
    title: "Heading Hierarchy Skips Levels",
    provenance: ON_PAGE,
    evaluate: ({ derived }) => {
      const hierarchy = derived.headingHierarchy;
      if (!hierarchy) return na();
      if (hierarchy.valid && hierarchy.startsAtH1) return pass();
      if (!hierarchy.startsAtH1 && hierarchy.valid) {
        return fail("The first heading on the page is not an H1.", "Open the document outline with an H1.");
      }
      return fail(
        `${hierarchy.skips} heading${hierarchy.skips === 1 ? "" : "s"} jump more than one level.`,
        "Do not skip levels: H2 under H1, H3 under H2.",
      );
    },
  },
  {
    id: "seo.headings.nonempty",
    pillar: "seo",
    weight: 1,
    severity: "warning",
    title: "Empty Headings",
    provenance: ON_PAGE,
    evaluate: ({ payload }) => {
      const empty = payload.content.emptyHeadingCount;
      return empty === 0
        ? pass()
        : fail(`${empty} heading${empty === 1 ? "" : "s"} contain no text.`, "Remove empty headings or give them text.");
    },
  },
  {
    id: "seo.content.depth",
    pillar: "seo",
    weight: 2,
    severity: "warning",
    title: "Thin Content",
    provenance: ON_PAGE,
    evaluate: ({ payload }) => {
      const words = payload.content.wordCount;
      return words >= 300
        ? pass()
        : fail(`Page has ${words} words.`, "Expand to at least 300 words when the page warrants it.");
    },
  },
  {
    id: "seo.images.alt",
    pillar: "seo",
    weight: 2,
    severity: "warning",
    title: "Images Missing Alt Text",
    provenance: ON_PAGE,
    evaluate: ({ payload, derived }) => {
      if (payload.content.imagesCount === 0) return na();
      const missing = derived.imagesWithoutAlt;
      return missing === 0
        ? pass()
        : fail(`${missing} image${missing === 1 ? "" : "s"} lack alt attributes.`, "Add descriptive alt text to every image.");
    },
  },
  {
    id: "seo.og.core",
    pillar: "seo",
    weight: 2,
    severity: "info",
    title: "Open Graph Tags Incomplete",
    provenance: ON_PAGE,
    evaluate: ({ payload }) => {
      const { ogTitle, ogDescription, ogImage } = payload.metadata;
      const missing = [!ogTitle && "og:title", !ogDescription && "og:description", !ogImage && "og:image"].filter(
        Boolean,
      );
      return missing.length
        ? fail(`Missing ${missing.join(", ")}.`, "Add og:title, og:description, and a 1200×630 og:image.")
        : pass();
    },
  },
  {
    id: "seo.og.url",
    pillar: "seo",
    weight: 1,
    severity: "info",
    title: "Missing og:url",
    provenance: ON_PAGE,
    evaluate: ({ payload }) =>
      payload.metadata.ogUrl ? pass() : fail("No og:url meta tag found.", "Add og:url matching the canonical URL."),
  },
  {
    id: "seo.twitter.card",
    pillar: "seo",
    weight: 1,
    severity: "info",
    title: "Missing Twitter Card",
    provenance: ON_PAGE,
    evaluate: ({ payload }) =>
      payload.metadata.twitterCard
        ? pass()
        : fail("No twitter:card meta tag found.", 'Add <meta name="twitter:card" content="summary_large_image">.'),
  },
  {
    id: "seo.links.internal",
    pillar: "seo",
    weight: 2,
    severity: "warning",
    title: "Few Internal Links",
    provenance: LINKING,
    evaluate: ({ payload }) => {
      const internal = payload.content.internalLinksCount;
      return internal >= 3
        ? pass()
        : fail(`Only ${internal} internal link${internal === 1 ? "" : "s"}.`, "Link to at least three related pages with descriptive anchors.");
    },
  },
  {
    id: "seo.links.anchors",
    pillar: "seo",
    weight: 1,
    severity: "info",
    title: "Generic Anchor Text",
    provenance: LINKING,
    evaluate: ({ payload }) => {
      if (payload.content.linksCount === 0) return na();
      const generic = payload.content.genericAnchorCount;
      return generic === 0
        ? pass()
        : fail(`${generic} link${generic === 1 ? "" : "s"} use stock anchor text such as "click here".`, "Use descriptive anchor text that names the destination.");
    },
  },
  {
    id: "seo.links.count",
    pillar: "seo",
    weight: 1,
    severity: "info",
    title: "Too Many Links",
    provenance: LINKING,
    evaluate: ({ payload }) => {
      const links = payload.content.linksCount;
      return links <= 100 ? pass() : fail(`Page has ${links} links.`, "Prioritize the links that matter; trim navigation and footer clutter.");
    },
  },
  {
    id: "seo.robots.indexable",
    pillar: "seo",
    weight: 5,
    severity: "warning",
    title: "Page Is Set to noindex",
    provenance: TECHNICAL,
    evaluate: ({ derived }) =>
      derived.robotsMeta.noindex
        ? fail("The robots meta tag contains noindex, so search engines will drop this page.", "Remove noindex unless exclusion is intentional.")
        : pass(),
  },
  {
    id: "seo.url.clean",
    pillar: "seo",
    weight: 1,
    severity: "info",
    title: "URL Hygiene",
    provenance: TECHNICAL,
    evaluate: ({ derived }) =>
      derived.urlHygiene.issues.length
        ? fail(`URL has ${derived.urlHygiene.issues.join(", ")}.`, "Use lowercase, hyphenated, shallow paths without tracking parameters.")
        : pass(),
  },
  {
    id: "seo.hreflang.present",
    pillar: "seo",
    weight: 0,
    severity: "info",
    title: "hreflang Alternates",
    provenance: ["searchfit-seo:content-translation", "searchfit-seo:technical-seo"],
    evaluate: ({ payload }) => {
      const count = payload.metadata.hreflangCount;
      if (count === 0) return na();
      return count === 1
        ? fail("Only one hreflang alternate is declared; alternates must reference every language version including this one.", "Declare all language versions plus x-default.")
        : pass();
    },
  },
];
