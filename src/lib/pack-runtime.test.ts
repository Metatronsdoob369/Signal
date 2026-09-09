import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import type { BeaconPayload } from "@/contracts";
import { buildPackScript } from "@/lib/pack-script";
import { parseBeaconPayload } from "@/lib/payload-guard";
import { scoreAudit } from "@/lib/scorer";

type Captured = { resolveUrl: string | null; beacons: unknown[] };

/**
 * Executes the served pack inside a headless DOM against fixture HTML and captures what
 * it posts. This is the collector's contract test: the payload must clear the same
 * ingest guard the beacon route applies, with no page prose inside it.
 */
async function runPack(html: string, url = "https://client.example.com/guides/signal/"): Promise<Captured> {
  const window = new Window({
    url,
    settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
  });
  const captured: Captured = { resolveUrl: null, beacons: [] };

  const fetchStub = async (input: unknown, init?: { method?: string; body?: unknown }) => {
    const target = String(input);
    if (target.includes("/api/resolve")) {
      captured.resolveUrl = target;
      return new window.Response("{}", { status: 404 });
    }
    if (target.includes("/api/beacon")) {
      captured.beacons.push(JSON.parse(String(init?.body ?? "{}")));
      return new window.Response('{"success":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new window.Response("", { status: 404 });
  };
  Object.defineProperty(window, "fetch", { value: fetchStub, configurable: true, writable: true });
  Object.defineProperty(window.navigator, "sendBeacon", { value: undefined, configurable: true });

  window.document.write(html);
  // happy-dom leaves a written document at readyState "interactive" and does not run
  // scripts appended after parse, so evaluate the pack directly and fire load ourselves.
  window.eval(buildPackScript({ key: "k3y", origin: "https://signal.example.com" }));
  window.dispatchEvent(new window.Event("load"));

  for (let attempt = 0; attempt < 10 && captured.beacons.length === 0; attempt += 1) {
    await window.happyDOM.waitUntilComplete();
    if (captured.beacons.length === 0) await new Promise((done) => setTimeout(done, 60));
  }
  await window.happyDOM.close();
  return captured;
}

function payloadOf(captured: Captured): BeaconPayload {
  const guarded = parseBeaconPayload(captured.beacons[0]);
  if (!guarded.ok) throw new Error(`Payload rejected: ${guarded.error}`);
  return guarded.payload;
}

const EXAMPLE_PAGE = readFileSync(resolve("public/example-client-page.html"), "utf8")
  // The fixture bootstraps the pack from a query string; the test injects it directly.
  .replace(/<script>\s*\(function \(\) \{\s*var params[\s\S]*?<\/script>/, "");

const BARE_PAGE = `<!DOCTYPE html><html><head><title>Hi</title></head><body>
<h3>Skipped level</h3><h2></h2>
<p>Short.</p>
<img src="/a.png"><img src="/b.png" alt="">
<a href="/x">click here</a><a href="https://other.example.org/">Read more</a><a href="/y"></a>
<button></button>
<script type="application/ld+json">{ "@type": "Article", "headline": "x", }</script>
<script src="https://cdn.example.net/lib.js"></script>
</body></html>`;

describe("pack runtime", () => {
  it("collects structured observations from the example client page", async () => {
    const captured = await runPack(EXAMPLE_PAGE, "https://client.example.com/example-client-page.html");
    expect(captured.resolveUrl).toContain("/api/resolve?key=k3y");
    expect(captured.beacons).toHaveLength(1);

    const payload = payloadOf(captured);
    expect(payload.packVersion).toBe("0.2.1");
    expect(payload.intent).toBe("audit");
    expect(payload.metadata.title).toContain("Signal Example Client Page");
    expect(payload.metadata.twitterCard).toBe("summary_large_image");
    expect(payload.metadata.ogUrl).toContain("example-client-page.html");
    expect(payload.metadata.publishedTime).toBe("2026-08-22T00:00:00Z");

    expect(payload.content.headingLevels[0]).toBe(1);
    expect(payload.content.headingLevels).toEqual([1, 2, 2, 2, 2, 3]);
    expect(payload.content.emptyHeadingCount).toBe(0);
    expect(payload.content.questionHeadingCount).toBe(3);
    expect(payload.content.questionAnswerWords).toHaveLength(3);
    for (const words of payload.content.questionAnswerWords) {
      expect(words).toBeGreaterThanOrEqual(15);
      expect(words).toBeLessThanOrEqual(80);
    }
    expect(payload.content.hasSummaryBlock).toBe(true);
    expect(payload.content.listCount).toBe(1);
    expect(payload.content.tableCount).toBe(1);
    expect(payload.content.definitionSentenceCount).toBeGreaterThanOrEqual(1);
    expect(payload.content.hasByline).toBe(true);
    expect(payload.content.timeElementCount).toBe(1);
    expect(payload.content.imagesWithDimensions).toBe(1);
    expect(payload.content.imagesLazy).toBe(1);
    expect(payload.content.externalLinksCount).toBe(1);
    expect(payload.content.genericAnchorCount).toBe(0);
    expect(payload.content.wordCount).toBeGreaterThan(300);

    expect(payload.aio.structuredDataCount).toBe(1);
    expect(payload.aio.schemaParseErrors).toBe(0);
    expect(payload.aio.hasFAQ).toBe(true);
    const types = payload.aio.schemaNodes.map((node) => node.type);
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebPage", "FAQPage"]));
    const org = payload.aio.schemaNodes.find((node) => node.type === "Organization");
    expect(org?.keys).toEqual(expect.arrayContaining(["name", "url", "logo", "sameAs"]));
    expect(org?.keys.some((key) => key.startsWith("@"))).toBe(false);

    expect(payload.structure.hasDoctype).toBe(true);
    expect(payload.structure.hasHtmlLang).toBe(true);
    expect(payload.structure.hasMain).toBe(true);
    expect(payload.accessibility.hasSkipLink).toBe(true);
    expect(payload.accessibility.inputsWithoutLabels).toBe(0);
  });

  it("never ships prose, markup, or schema values", async () => {
    const captured = await runPack(EXAMPLE_PAGE, "https://client.example.com/example-client-page.html");
    const raw = JSON.stringify(captured.beacons[0]);
    expect(raw).not.toContain("<");
    expect(raw).not.toContain("acceptedAnswer\":{");
    expect(raw).not.toContain("Open this page with a valid");
    expect(raw).not.toContain("github.com/Metatronsdoob369");
    expect(raw.length).toBeLessThan(8_192);
  });

  it("scores the example page well on AI readiness once crawl facts are known", async () => {
    const captured = await runPack(EXAMPLE_PAGE, "https://client.example.com/example-client-page.html");
    const { scores, findings } = scoreAudit(payloadOf(captured));
    expect(scores.aioDimensions?.structure.score).toBeGreaterThanOrEqual(80);
    expect(scores.aioDimensions?.extractability.score).toBeGreaterThanOrEqual(80);
    expect(scores.aioDimensions?.consistency.score).toBe(100);
    expect(findings.some((f) => f.ruleId === "aio.schema.present")).toBe(false);
    expect(findings.some((f) => f.ruleId === "seo.headings.hierarchy")).toBe(false);
  });

  it("observes the defects on a bare page without judging them client-side", async () => {
    const captured = await runPack(BARE_PAGE, "https://client.example.com/Bare_Page");
    const payload = payloadOf(captured);
    expect(payload.content.headingLevels).toEqual([3, 2]);
    expect(payload.content.emptyHeadingCount).toBe(1);
    expect(payload.content.genericAnchorCount).toBe(2);
    expect(payload.content.externalLinksCount).toBe(1);
    expect(payload.accessibility.linksWithoutText).toBe(1);
    expect(payload.accessibility.buttonsWithoutText).toBe(1);
    expect(payload.accessibility.imagesWithoutAlt).toBe(2);
    expect(payload.aio.schemaParseErrors).toBe(1);
    expect(payload.aio.hasStructuredData).toBe(true);
    expect(payload.structure.thirdPartyScriptCount).toBe(1);
    expect(payload.structure.hasHtmlLang).toBe(false);

    const { scores, findings } = scoreAudit(payload);
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toContain("seo.headings.hierarchy");
    expect(ids).toContain("seo.headings.nonempty");
    expect(ids).toContain("seo.links.anchors");
    expect(ids).toContain("aio.schema.valid-json");
    expect(ids).toContain("a11y.buttons.text");
    expect(ids).toContain("seo.url.clean");
    expect(scores.seo).toBeLessThan(50);
  });
});
