# Signal

One-line SEO + AIO audit pack. Register a domain, embed the pack, see scores on a token-scoped dashboard.

## Requirements

- Bun 1.3+
- Docker (Postgres 16)

## Setup

```bash
docker compose up -d
cp .env.example .env.local
bun install
bun run db:migrate
bun run test
bun run dev
```

App: http://localhost:3000

## Loop

1. Open `/` and register a domain (or `POST /api/sites` with `{ "domain": "example.com" }`).
2. Copy the embed snippet or open `/example-client-page.html?token=…`.
3. Refresh `/dashboard/[token]` for scores and findings.

## Scripts

| Script | Purpose |
|--------|---------|
| `bun run dev` | Next.js dev server |
| `bun run build` | Production build |
| `bun run test` | Vitest |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run db:generate` | Drizzle generate migrations |
| `bun run db:migrate` | Apply migrations |
| `bun run db:studio` | Drizzle Studio |

## Env

See `.env.example`:

- `DATABASE_URL` — Postgres connection string
- `APP_ORIGIN` — public origin used in embed snippets (default `http://localhost:3000`)
