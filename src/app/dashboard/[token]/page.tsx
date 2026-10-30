import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { setExperimentsEnabled } from "@/app/actions";
import { AIO_DIMENSIONS, aioDimensionScoreSchema } from "@/contracts";
import { db } from "@/db";
import { audits, findings, sites } from "@/db/schema";
import { splitAuditsByScope } from "@/lib/audit-scope";
import { BOTS_AS_OF, KNOWN_BOTS } from "@/lib/crawl/bots";
import { retrievalAccessSummary } from "@/lib/crawl/facts";
import { storedCrawlFacts } from "@/lib/crawl/store";
import { loadExperimentBoard } from "@/lib/experiment/store";
import { AIO_DIMENSION_LABELS, AIO_DIMENSION_WEIGHTS } from "@/lib/rules/weights";
import { pageScope } from "@/lib/tenant";
import { hashToken } from "@/lib/token";

export const dynamic = "force-dynamic";

/** Dashboard URLs carry the site token; they must never be indexed or followed. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ new?: string }>;
};

const dimensionsSchema = z.record(z.enum(AIO_DIMENSIONS), aioDimensionScoreSchema);

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-700";
  if (score >= 60) return "text-amber-700";
  return "text-red-700";
}

function ScoreTile({ label, value, testId }: { label: string; value: number | null; testId: string }) {
  return (
    <div>
      <p className="font-mono text-xs text-[var(--muted)]">{label}</p>
      <p
        className={`font-mono text-3xl font-semibold ${value === null ? "text-[var(--muted)]" : scoreColor(value)}`}
        data-testid={testId}
      >
        {value === null ? "—" : value}
      </p>
    </div>
  );
}

const ROLE_LABEL = { fetcher: "Answer-time fetch", search: "AI search index", trainer: "Training crawl" } as const;
const ACCESS_LABEL = {
  ok: { allow: "Allowed", disallow: "Blocked", unspecified: "No rule (allowed)" },
  missing: { allow: "Allowed", disallow: "Blocked", unspecified: "No robots.txt (allowed)" },
} as const;

export default async function DashboardPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { new: isNew } = await searchParams;

  const siteRows = await db
    .select()
    .from(sites)
    .where(eq(sites.tokenHash, hashToken(token)))
    .limit(1);

  if (siteRows.length === 0 || !siteRows[0].isActive) notFound();
  const site = siteRows[0];

  // Newest first. Site-scope audits (pages on the registered domain) carry the headline, the
  // breakdown, and the findings. App-scope audits (Signal's own example page opened with this
  // site's key) show as a demo only and never count toward the site.
  const recentAudits = await db
    .select()
    .from(audits)
    .where(eq(audits.siteId, site.id))
    .orderBy(desc(audits.createdAt))
    .limit(50);
  const scoped = splitAuditsByScope(recentAudits, site.domain);
  const latestAudit = scoped.latestSite;
  const exampleAudit = scoped.latestApp;

  const latestFindings = latestAudit
    ? await db
        .select()
        .from(findings)
        .where(eq(findings.auditId, latestAudit.id))
        .orderBy(desc(findings.createdAt))
        .limit(50)
    : [];
  const exampleFindingCount = exampleAudit
    ? (await db.select({ id: findings.id }).from(findings).where(eq(findings.auditId, exampleAudit.id))).length
    : 0;

  const experimentBoard = await loadExperimentBoard(site.id);

  const crawl = storedCrawlFacts(site);
  const access = retrievalAccessSummary(crawl);
  const parsedDimensions = latestAudit ? dimensionsSchema.safeParse(latestAudit.aioDimensions) : null;
  const dimensions = parsedDimensions?.success ? parsedDimensions.data : null;

  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  const embedCode = `<script defer src="${origin}/api/pack?key=${site.publicKey}"></script>`;

  const headline = latestAudit
    ? {
        seo: Number(latestAudit.seoScore),
        aio: Number(latestAudit.aioScore),
        overall: Number(latestAudit.overallScore),
      }
    : null;

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-mono text-lg font-semibold tracking-tight">
            Signal
          </Link>
          <span className="font-mono text-xs text-[var(--muted)]" data-testid="site-domain">
            {site.domain}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {isNew ? (
          <div className="mb-8 border border-[var(--line)] bg-white p-5" data-testid="token-created">
            <p className="font-mono text-xs uppercase tracking-wide text-[var(--muted)]">
              Token created — save it now
            </p>
            <p className="mt-2 font-mono text-sm break-all" data-testid="site-token">
              {token}
            </p>
            <p className="mt-4 text-sm text-[var(--muted)]">
              This URL is the dashboard. Anyone with this token can see this site&apos;s audits. The embed key
              below is public and cannot open the dashboard.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-mono text-3xl font-semibold tracking-tight">
              {site.name || site.domain}
            </h1>
            <p className="mt-1 font-mono text-sm text-[var(--muted)]">{site.domain}</p>
            <p className="mt-2 font-mono text-xs text-[var(--muted)]" data-testid="crawl-access-summary">
              {access
                ? `AI crawler access: ${access.allowed} of ${access.total} retrieval agents allowed`
                : crawl
                  ? "AI crawler access: robots.txt read failed, retrying"
                  : "AI crawler access: not checked yet"}
            </p>
          </div>
          <div className="flex gap-8" data-testid="scores">
            <ScoreTile label="Overall" value={headline?.overall ?? null} testId="score-overall" />
            <ScoreTile label="SEO" value={headline?.seo ?? null} testId="score-seo" />
            <ScoreTile label="AIO" value={headline?.aio ?? null} testId="score-aio" />
          </div>
        </div>

        {!headline ? (
          <p className="mt-4 text-sm text-[var(--muted)]" data-testid="headline-empty">
            No audit from {site.domain} yet. Scores appear after the first load of a page on this domain with
            the embed script.
          </p>
        ) : null}

        {exampleAudit ? (
          <section
            className="mt-8 border border-dashed border-[var(--line)] bg-white p-5"
            data-testid="example-audit"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="font-mono text-sm font-medium">Example page audit</h2>
                <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
                  Signal&apos;s example client page was opened with this site&apos;s embed key. It proves the
                  pipe works and never counts toward {site.domain}: it stays out of the scores above, the
                  breakdown, the findings, and the experiments.
                </p>
                <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                  {exampleAudit.createdAt.toISOString()} · {exampleFindingCount} findings
                </p>
              </div>
              <div className="flex gap-8">
                <ScoreTile label="Overall" value={Number(exampleAudit.overallScore)} testId="example-score-overall" />
                <ScoreTile label="SEO" value={Number(exampleAudit.seoScore)} testId="example-score-seo" />
                <ScoreTile label="AIO" value={Number(exampleAudit.aioScore)} testId="example-score-aio" />
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-10 border border-[var(--line)] bg-white p-5" data-testid="embed">
          <h2 className="font-mono text-sm font-medium">Embed</h2>
          <pre className="mt-3 overflow-x-auto font-mono text-xs leading-relaxed" data-testid="embed-code">
            {embedCode}
          </pre>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Or open{" "}
            <a
              className="underline"
              href={`/example-client-page.html?key=${site.publicKey}`}
              data-testid="example-client-link"
            >
              the example client page
            </a>{" "}
            with this site&apos;s embed key. It is a demo: its audit shows separately and never counts toward
            this site.
          </p>
        </section>

        <section className="mt-10" data-testid="aio-breakdown">
          <h2 className="font-mono text-sm font-medium">AI readiness breakdown</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Five deterministic dimensions from the latest audit of a page on this domain. Weights are v0.2
            priors; a dimension reads &ldquo;unknown&rdquo; when Signal has no evidence for it yet.
          </p>
          {dimensions ? (
            <div className="mt-4 overflow-x-auto border border-[var(--line)] bg-white">
              <table className="min-w-full text-left font-mono text-xs">
                <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Dimension</th>
                    <th className="px-4 py-3 font-medium">Weight</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Rules passed</th>
                  </tr>
                </thead>
                <tbody>
                  {AIO_DIMENSIONS.map((dimension) => {
                    const row = dimensions[dimension];
                    return (
                      <tr key={dimension} className="border-b border-[var(--line)] last:border-0">
                        <td className="px-4 py-3">{AIO_DIMENSION_LABELS[dimension]}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{AIO_DIMENSION_WEIGHTS[dimension]}</td>
                        <td
                          className={`px-4 py-3 font-semibold ${row?.score === null || row?.score === undefined ? "text-[var(--muted)]" : scoreColor(row.score)}`}
                          data-testid={`dimension-${dimension}`}
                        >
                          {row?.score === null || row?.score === undefined ? "unknown" : row.score}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {row ? `${row.passed} / ${row.applicable}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]" data-testid="aio-breakdown-empty">
              No v0.2 audit of this domain yet. Load a page on it with the embed script.
            </p>
          )}
        </section>

        <section className="mt-10" data-testid="crawl-access">
          <h2 className="font-mono text-sm font-medium">AI crawler access</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Read from this site&apos;s robots.txt and llms.txt by Signal&apos;s server, refreshed daily. Answer-time
            fetchers and AI search indexes are scored; training crawlers are reported only, since blocking them
            is a policy choice. Agent list as of {BOTS_AS_OF}.
          </p>
          {crawl ? (
            <div className="mt-4 overflow-x-auto border border-[var(--line)] bg-white">
              <div className="flex flex-wrap gap-6 border-b border-[var(--line)] px-4 py-3 font-mono text-xs text-[var(--muted)]">
                <span data-testid="robots-status">robots.txt: {crawl.robots.status}</span>
                <span>sitemap declared: {crawl.robots.sitemapDeclared ? "yes" : "no"}</span>
                <span data-testid="llms-status">llms.txt: {crawl.llmsTxt.status}</span>
                <span>checked {new Date(crawl.fetchedAt).toISOString()}</span>
              </div>
              {crawl.robots.status === "error" ? (
                <p className="px-4 py-4 text-sm text-[var(--muted)]" data-testid="crawl-access-error">
                  robots.txt could not be read, so per-agent policy is unknown. Signal retries within the
                  hour; the crawl dimension stays excluded until a read succeeds.
                </p>
              ) : (
              <table className="min-w-full text-left font-mono text-xs">
                <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Agent</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Site root</th>
                  </tr>
                </thead>
                <tbody>
                  {KNOWN_BOTS.map((bot) => {
                    const state = crawl.robots.bots[bot.token] ?? "unspecified";
                    const blocked = state === "disallow";
                    const scored = bot.role !== "trainer";
                    const labels = ACCESS_LABEL[crawl.robots.status === "missing" ? "missing" : "ok"];
                    return (
                      <tr key={bot.token} className="border-b border-[var(--line)] last:border-0">
                        <td className="px-4 py-3">{bot.token}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{bot.vendor}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {ROLE_LABEL[bot.role]}
                          {scored ? "" : " · not scored"}
                        </td>
                        <td className={`px-4 py-3 ${blocked ? (scored ? "text-red-700" : "text-amber-700") : "text-emerald-700"}`}>
                          {labels[state]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]" data-testid="crawl-access-empty">
              Not checked yet. Signal reads robots.txt after the first beacon.
            </p>
          )}
        </section>

        <section className="mt-10" data-testid="experiments">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-mono text-sm font-medium">Experiments</h2>
              <p className="mt-1 font-mono text-xs text-[var(--muted)]" data-testid="experiments-state">
                {site.experimentsEnabled
                  ? "Experiments: on. Visitors to pages on this domain may receive a title or description variant."
                  : "Experiments: off. Visitors see each page's own title and description."}
              </p>
            </div>
            <form action={setExperimentsEnabled}>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="enabled" value={site.experimentsEnabled ? "off" : "on"} />
              <button
                type="submit"
                data-testid="experiments-toggle"
                className="border border-[var(--ink)] px-4 py-2 font-mono text-xs font-medium transition hover:bg-[var(--ink)] hover:text-[var(--paper)]"
              >
                {site.experimentsEnabled ? "Turn experiments off" : "Turn experiments on"}
              </button>
            </form>
          </div>
          {experimentBoard.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]" data-testid="experiments-empty">
              No title or description variants yet.{" "}
              {site.experimentsEnabled
                ? "Load a page on this domain with the embed script."
                : "Turn experiments on, then load a page on this domain with the embed script."}
            </p>
          ) : (
            <div className="mt-4 space-y-6" data-testid="experiments-board">
              {experimentBoard.map((board) => (
                <div key={board.path} className="border border-[var(--line)] bg-white">
                  <p
                    className="border-b border-[var(--line)] px-4 py-3 font-mono text-xs text-[var(--muted)]"
                    data-testid="experiment-path"
                  >
                    {board.path}
                  </p>
                  <table className="min-w-full text-left font-mono text-xs">
                    <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                      <tr>
                        <th className="px-4 py-3 font-medium">Title</th>
                        <th className="px-4 py-3 font-medium">Impressions</th>
                        <th className="px-4 py-3 font-medium">Engagement</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.variants.map((row) => (
                        <tr key={row.id} className="border-b border-[var(--line)] last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-medium">{row.title}</p>
                            <p className="mt-1 max-w-xl text-[var(--muted)]">{row.description}</p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{row.impressions}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {(row.rate * 100).toFixed(0)}%
                          </td>
                          <td className="px-4 py-3">
                            {row.isDefault ? "Default" : row.source}
                            {row.needsImpressions > 0
                              ? ` · Needs ${row.needsImpressions} more impressions before a promote decision`
                              : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10" data-testid="latest-findings">
          <h2 className="font-mono text-sm font-medium">Latest findings</h2>
          {latestFindings.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]" data-testid="findings-empty">
              No audit of this domain yet. Load a page on it with the embed script.
            </p>
          ) : (
            <ul
              className="mt-4 divide-y divide-[var(--line)] border border-[var(--line)] bg-white"
              data-testid="findings-list"
            >
              {latestFindings.map((finding) => (
                <li key={finding.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">
                      {finding.severity}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">
                      {finding.category}
                    </span>
                    {finding.ruleId ? (
                      <span className="font-mono text-[10px] tracking-wide text-[var(--muted)]">
                        {finding.ruleId}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-sm font-medium">{finding.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{finding.message}</p>
                  {finding.fix ? (
                    <p className="mt-1 text-sm text-[var(--ink)]">Fix: {finding.fix}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10" data-testid="recent-audits">
          <h2 className="font-mono text-sm font-medium">Recent audits</h2>
          {recentAudits.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]" data-testid="audits-empty">
              Waiting for the first beacon.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto border border-[var(--line)] bg-white" data-testid="audits-table">
              <table className="min-w-full text-left font-mono text-xs">
                <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Page</th>
                    <th className="px-4 py-3 font-medium">URL</th>
                    <th className="px-4 py-3 font-medium">SEO</th>
                    <th className="px-4 py-3 font-medium">AIO</th>
                    <th className="px-4 py-3 font-medium">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAudits.map((audit) => (
                    <tr key={audit.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {audit.createdAt.toISOString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">
                        {pageScope(audit.url, site.domain) === "site" ? "site" : "example page"}
                      </td>
                      <td className="px-4 py-3 max-w-md truncate">{audit.url}</td>
                      <td className="px-4 py-3">{Number(audit.seoScore)}</td>
                      <td className="px-4 py-3">{Number(audit.aioScore)}</td>
                      <td className="px-4 py-3">{Number(audit.overallScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
