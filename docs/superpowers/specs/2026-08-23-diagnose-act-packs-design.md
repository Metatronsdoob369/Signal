# Diagnose + act packs — Signal MVP

One product. One register. One token. One script tag. One dashboard.

## Pack A — diagnose (existing)

- Embed from `GET /api/pack?token=`
- Read-only collection of structured signals
- Deterministic SEO + AIO scores
- Token-scoped `/dashboard/[token]`
- Hard nos: no page-body inference, no HTML exfiltration, no global site list

## Pack B — act (blended in this MVP)

Ported from agentic-seo algorithms, not the Express/SQLite server.

- Same token and same pack script
- `GET /api/resolve` draws a title + description variant (Thompson sampling)
- Pack may set `document.title` and `meta[name=description]` only
- Exit beacon (`intent: "experiment"`) records impression / engage / vitals
- Heuristic mutants constrained by Signal title/description rules
- Promote when a challenger has 30+ impressions and ≥15% better engagement than the default
- Dashboard Experiments section shows impressions and rates — never invented lift copy

## Shared contracts

- Beacon remains one POST (`/api/beacon`) with optional `intent`, `variantId`, `events[]`
- Resolve query: `token`, `path`, `t`, `d`
- Tables: `pages`, `variants`, `experiment_events`

## Out of this pass

- OpenAI / LLM mutants
- Live Google Search Console
- Terrain as product runtime (repo husk only)
- JSON-LD, heading, or body mutation
- Cross-tenant learning
