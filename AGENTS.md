# Signal — agent entry context

> Load this first. Property Hydra is a separate product. Do not write into `~/property-hydra`.

## Current state — 2026-08-22

**Thesis:** one embed script audits a page on load. Deterministic SEO + AIO scores. Token-scoped dashboard.

**Wedge:** register domain → embed pack → beacon → `/dashboard/[token]`.

### Hard nos

- No cloud inference of page content in v0.1
- No auto-fix that mutates the client DOM
- No cross-tenant “self-learning” / invented lift claims
- No unauthenticated global site listing
- No secrets in git (`.env*` ignored)

### Run

```bash
docker compose up -d
cp .env.example .env.local
bun install
bun run db:migrate
bun run test
bun run dev
```

### Proprietary husk

`terrain/` is NODE OUT internal. Topological shatter map of this repo — no time concat, no client DOM writes, not for distribution. `bun run terrain:husk`

### Stack

Next.js 16 App Router · React 19 · Tailwind v4 · Postgres 16 · Drizzle · Zod · Vitest · Bun
