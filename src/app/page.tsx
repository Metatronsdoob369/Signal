import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-mono text-lg font-semibold tracking-tight">Signal</span>
          <span className="font-mono text-xs text-[var(--muted)]">Autonomous site auditor</span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="max-w-2xl">
          <h1 className="font-mono text-5xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
            A script that audits itself.
          </h1>
          <p className="mt-6 text-xl leading-relaxed text-[var(--muted)]">
            Drop one line of code on any client page. Signal collects SEO and AIO signals, scores
            them deterministically, and shows you a token-scoped dashboard.
          </p>
          <RegisterForm />
        </div>

        <div className="mt-16 border border-[var(--line)] bg-white p-6">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <span className="font-mono text-xs text-[var(--muted)]">Embed code</span>
            <span className="font-mono text-xs text-[var(--muted)]">index.html</span>
          </div>
          <pre className="mt-4 overflow-x-auto font-mono text-sm leading-relaxed text-[var(--ink)]">
            <code>{`<script defer src="https://your-origin/api/pack?key=…"></script>`}</code>
          </pre>
        </div>
      </section>

      <section className="mx-auto max-w-6xl border-t border-[var(--line)] px-6 py-16">
        <div className="grid gap-12 md:grid-cols-3">
          <div>
            <span className="font-mono text-xs text-[var(--muted)]">01</span>
            <h2 className="mt-2 font-mono text-lg font-medium">Audit</h2>
            <p className="mt-2 text-[var(--muted)]">
              Reads titles, descriptions, canonicals, headings, schema, links, and alt text on every
              page load.
            </p>
          </div>
          <div>
            <span className="font-mono text-xs text-[var(--muted)]">02</span>
            <h2 className="mt-2 font-mono text-lg font-medium">Score</h2>
            <p className="mt-2 text-[var(--muted)]">
              Deterministic SEO and AIO weights. No cloud model on the ingest path.
            </p>
          </div>
          <div>
            <span className="font-mono text-xs text-[var(--muted)]">03</span>
            <h2 className="mt-2 font-mono text-lg font-medium">Dashboard</h2>
            <p className="mt-2 text-[var(--muted)]">
              Token-scoped view of scores and findings for that site only.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
