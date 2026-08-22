import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { audits, findings, sites } from "@/db/schema";
import { hashToken } from "@/lib/token";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ new?: string }>;
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-700";
  if (score >= 60) return "text-amber-700";
  return "text-red-700";
}

export default async function DashboardPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { new: isNew } = await searchParams;

  const siteRows = await db
    .select()
    .from(sites)
    .where(eq(sites.tokenHash, hashToken(token)))
    .limit(1);

  if (siteRows.length === 0) notFound();
  const site = siteRows[0];

  const recentAudits = await db
    .select()
    .from(audits)
    .where(eq(audits.siteId, site.id))
    .orderBy(desc(audits.createdAt))
    .limit(20);

  const latestAudit = recentAudits[0];
  const latestFindings = latestAudit
    ? await db
        .select()
        .from(findings)
        .where(eq(findings.auditId, latestAudit.id))
        .orderBy(desc(findings.createdAt))
        .limit(50)
    : [];

  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  const embedCode = `<script defer src="${origin}/api/pack?token=${token}"></script>`;

  const seo = Number(site.seoScore ?? latestAudit?.seoScore ?? 0);
  const aio = Number(site.aioScore ?? latestAudit?.aioScore ?? 0);
  const overall = Number(site.overallScore ?? latestAudit?.overallScore ?? 0);

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-mono text-lg font-semibold tracking-tight">
            Signal
          </Link>
          <span className="font-mono text-xs text-[var(--muted)]">{site.domain}</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {isNew ? (
          <div className="mb-8 border border-[var(--line)] bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-wide text-[var(--muted)]">
              Token created — save it now
            </p>
            <p className="mt-2 font-mono text-sm break-all">{token}</p>
            <p className="mt-4 text-sm text-[var(--muted)]">
              This URL is the dashboard. Anyone with the token can see this site&apos;s audits.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-mono text-3xl font-semibold tracking-tight">
              {site.name || site.domain}
            </h1>
            <p className="mt-1 font-mono text-sm text-[var(--muted)]">{site.domain}</p>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="font-mono text-xs text-[var(--muted)]">Overall</p>
              <p className={`font-mono text-3xl font-semibold ${scoreColor(overall)}`}>{overall}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-[var(--muted)]">SEO</p>
              <p className={`font-mono text-3xl font-semibold ${scoreColor(seo)}`}>{seo}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-[var(--muted)]">AIO</p>
              <p className={`font-mono text-3xl font-semibold ${scoreColor(aio)}`}>{aio}</p>
            </div>
          </div>
        </div>

        <section className="mt-10 border border-[var(--line)] bg-white p-5">
          <h2 className="font-mono text-sm font-medium">Embed</h2>
          <pre className="mt-3 overflow-x-auto font-mono text-xs leading-relaxed">{embedCode}</pre>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Or open{" "}
            <a className="underline" href={`/example-client-page.html?token=${token}`}>
              the example client page
            </a>{" "}
            with this token.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-sm font-medium">Latest findings</h2>
          {latestFindings.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No audits yet. Load a page with the embed script.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--line)] border border-[var(--line)] bg-white">
              {latestFindings.map((finding) => (
                <li key={finding.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">
                      {finding.severity}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">
                      {finding.category}
                    </span>
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

        <section className="mt-10">
          <h2 className="font-mono text-sm font-medium">Recent audits</h2>
          {recentAudits.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Waiting for the first beacon.</p>
          ) : (
            <div className="mt-4 overflow-x-auto border border-[var(--line)] bg-white">
              <table className="min-w-full text-left font-mono text-xs">
                <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
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
