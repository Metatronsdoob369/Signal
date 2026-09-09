import { fail, na, pass, type Rule } from "../types";

const TECHNICAL = ["searchfit-seo:technical-seo"] as const;

export const PERFORMANCE_RULES: readonly Rule[] = [
  {
    id: "perf.lcp",
    pillar: "performance",
    weight: 4,
    severity: "warning",
    title: "Slow Largest Contentful Paint",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const lcp = payload.performance.largestContentfulPaint;
      if (lcp === undefined) return na();
      return lcp <= 2500
        ? pass()
        : fail(`LCP is ${Math.round(lcp)}ms (target under 2500ms).`, "Preload the hero image or font and reduce render-blocking work.");
    },
  },
  {
    id: "perf.fcp",
    pillar: "performance",
    weight: 3,
    severity: "warning",
    title: "Slow First Contentful Paint",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const fcp = payload.performance.firstContentfulPaint;
      if (fcp === undefined) return na();
      return fcp <= 1800
        ? pass()
        : fail(`FCP is ${Math.round(fcp)}ms (target under 1800ms).`, "Inline critical CSS and defer non-critical scripts.");
    },
  },
  {
    id: "perf.cls",
    pillar: "performance",
    weight: 3,
    severity: "warning",
    title: "Layout Shift",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const cls = payload.performance.cumulativeLayoutShift;
      if (cls === undefined) return na();
      return cls <= 0.1
        ? pass()
        : fail(`CLS is ${cls.toFixed(3)} (target under 0.1).`, "Reserve space for images, ads, and fonts with explicit dimensions.");
    },
  },
  {
    id: "perf.inp",
    pillar: "performance",
    weight: 2,
    severity: "warning",
    title: "Slow Interaction Response",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const inp = payload.performance.interactionToNextPaint;
      if (inp === undefined) return na();
      return inp <= 200
        ? pass()
        : fail(`Longest interaction took ${Math.round(inp)}ms to paint (target under 200ms).`, "Break up long tasks and defer non-essential handlers.");
    },
  },
  {
    id: "perf.ttfb",
    pillar: "performance",
    weight: 2,
    severity: "warning",
    title: "Slow Server Response",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const ttfb = payload.performance.timeToFirstByte;
      if (ttfb === undefined) return na();
      return ttfb <= 800
        ? pass()
        : fail(`Time to first byte is ${Math.round(ttfb)}ms (target under 800ms).`, "Cache at the edge or speed up the origin.");
    },
  },
  {
    id: "perf.resources",
    pillar: "performance",
    weight: 1,
    severity: "info",
    title: "Too Many Resources",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const count = payload.performance.resourceCount;
      if (count === undefined) return na();
      return count <= 100 ? pass() : fail(`Page loads ${count} resources.`, "Remove unused assets and combine where possible.");
    },
  },
  {
    id: "perf.transfer",
    pillar: "performance",
    weight: 2,
    severity: "warning",
    title: "Heavy Page Weight",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const bytes = payload.performance.transferBytes;
      if (bytes === undefined) return na();
      const mb = bytes / 1_048_576;
      return mb <= 3 ? pass() : fail(`Page transferred ${mb.toFixed(1)} MB.`, "Compress images to WebP/AVIF and trim scripts.");
    },
  },
  {
    id: "perf.blocking-scripts",
    pillar: "performance",
    weight: 2,
    severity: "warning",
    title: "Render-Blocking Scripts",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const blocking = payload.structure.headScriptsBlocking;
      return blocking === 0
        ? pass()
        : fail(`${blocking} script${blocking === 1 ? "" : "s"} in <head> load without async or defer.`, "Add defer (or async) to head scripts.");
    },
  },
  {
    id: "perf.third-party",
    pillar: "performance",
    weight: 1,
    severity: "info",
    title: "Many Third-Party Scripts",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const count = payload.structure.thirdPartyScriptCount;
      return count <= 10 ? pass() : fail(`${count} third-party scripts load on this page.`, "Audit tags and remove what no longer earns its cost.");
    },
  },
  {
    id: "perf.images.dimensions",
    pillar: "performance",
    weight: 2,
    severity: "warning",
    title: "Images Without Dimensions",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const total = payload.content.imagesCount;
      if (total === 0) return na();
      const sized = payload.content.imagesWithDimensions;
      return sized >= total
        ? pass()
        : fail(`${total - sized} of ${total} images lack width and height attributes.`, "Set width and height on every image to prevent layout shift.");
    },
  },
  {
    id: "perf.images.lazy",
    pillar: "performance",
    weight: 1,
    severity: "info",
    title: "No Lazy-Loaded Images",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      if (payload.content.imagesCount < 6) return na();
      return payload.content.imagesLazy > 0
        ? pass()
        : fail(`${payload.content.imagesCount} images and none use loading="lazy".`, "Lazy-load images below the fold.");
    },
  },
];
