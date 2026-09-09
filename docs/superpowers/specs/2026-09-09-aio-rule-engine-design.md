# AIO rule engine — Signal v0.2

Same product, same wedge: register → embed → beacon → `/dashboard/[token]`. This pass replaces the v0.1 scorer with a deterministic rule engine and makes the AIO score mean something specific: **on-page AI readiness**, split into five dimensions.

## What changed and why

v0.1 AIO was base 50 plus five booleans. Three of them were wrong in practice: the definitions detector matched any English sentence containing "is", heading order was hardcoded true, and the value labelled LCP was load-event time. v0.2 fixes the collectors and moves every verdict into a rule catalog with weights, severities, and provenance.

## Where the logic came from

The SearchFit SEO plugin is eleven prompt checklists, not code. Its frameworks (seo-audit, technical-seo, on-page-seo, schema-markup, internal-linking, content-brief, ai-visibility) told us **what to check**. Signal encodes those checks as original, testable TypeScript rules; every rule carries a `provenance` list naming the skill that informed it. Nothing from the plugin is copied or executed.

What SearchFit's ai-visibility skill measures that an embed **cannot**: brand presence, sentiment, and position inside AI answers. Those are off-page. The AIO score is not that and the dashboard never implies it is.

## Rule engine

- `src/lib/rules/` — `types.ts`, `derive.ts` (pure helpers), `weights.ts` (v0.2 priors), `catalog/*.ts` (one file per pillar), `engine.ts`.
- A rule returns `pass | fail | na | info`. `na` excludes it from the ratio; `info` never scores but surfaces a finding.
- Pillar score = weighted pass ratio over applicable rules. Overall = mean of the five pillars (unchanged).
- AIO = weighted mean of dimension scores. Dimensions with no applicable rules are excluded and reported as **unknown**, never as 50.

| Dimension | Weight | Asks |
| --- | --- | --- |
| crawl | 20 | Can AI retrieval agents reach the site root? Are snippets allowed? |
| structure | 25 | Is there valid JSON-LD with a page type, an entity node, sameAs, required properties, dates? |
| extractability | 25 | Question headings, answer-first paragraphs, definitional sentences, sentence and paragraph length, lists and tables, summary block, heading density |
| entity | 15 | Author signal, dates, outbound citations, declared language |
| consistency | 15 | Title vs H1, title vs og:title, description vs og:description |

Weights are priors. They encode a judgment, not a measured outcome, and nothing in the product presents them as validated.

## Thin collector, thick server

The pack (`src/lib/pack-script.ts`, v0.2.0, budget 24 KB) ships **observations**: heading levels in order, JSON-LD `@type` plus property **names**, word counts of the paragraph after each question heading, counts of lists, tables, definitional sentences, generic anchors, images with dimensions, blocking head scripts, third-party scripts, mixed-content requests, and real LCP / CLS / INP / TTFB. Verdicts (hierarchy skips, schema completeness, answer-first ratio, canonical match) are derived server-side in `derive.ts`.

Body prose never leaves the page. Word, sentence, and definition counts are computed in the browser and only the numbers travel. The runtime test (`pack-runtime.test.ts`) executes the served pack in a headless DOM and pushes the captured payload through the same guard the beacon route uses.

## AI crawler access (site-level)

Signal's **server** reads `https://<domain>/robots.txt` and `/llms.txt` for the registered hostname: https only, one same-host redirect at most, 5 s timeout, 256 KB cap, fetched after the response via `after()` so a beacon is never slowed. The visitor's browser is not involved and no page content is read.

Bots are a data table (`src/lib/crawl/bots.ts`, `BOTS_AS_OF`) with three roles:

- **fetcher / search** — answer-time fetchers and AI search indexes. Blocking these removes the site from AI answers. **Scored.**
- **trainer** — training crawlers. Blocking them is a legitimate policy choice. **Reported, never scored.**

Access is evaluated for the site root per RFC 9309 group selection. A failed fetch stores `status: error`, retries within the hour, and the crawl dimension reads unknown; it never defaults to "open".

Residual: registering a domain makes Signal's server GET two fixed paths on whatever public hostname was typed (rate-limited 10/hour/IP, https only, no response body stored beyond ok / missing / error and per-agent verdicts). Reserved and private-network suffixes (`localhost`, `local`, `internal`, `lan`, `home`, `intranet`, `corp`, `test`, `invalid`, `example`, `onion`) are rejected at registration. DNS that resolves a public name to a private address is not checked in v0.2.

## Contracts and storage

- Every v0.2 field is optional-with-default; a v0.1 pack still validates. `FORBIDDEN_CONTENT_KEYS` and the HTML sniff still apply.
- `findings.rule_id`, `audits.aio_dimensions`, `sites.crawl_facts`, `sites.crawl_facts_at` — migration `0002_aio_rule_engine`.
- Beacon route: score with stored crawl facts, persist dimensions and rule ids, schedule a refresh when stale. Registration schedules the first fetch.

## Dashboard

Adds the AI readiness breakdown (five rows, weight, score or unknown, rules passed), the AI crawler access table (per agent: vendor, role, site-root policy, scored or not), robots / llms.txt status, and the rule id on each finding. Copy stays inside the invented-lift lock.

## AI-first posture

Applied from the ai-firstify principles: the scorer is a deterministic **tool**, not a model; the rule catalog is data with progressive disclosure; the pack executes in a headless DOM as its own **feedback loop**; scope stays narrow — no LLM, no auto-fix, no cross-tenant learning. One deliberate departure: Signal is a multi-tenant deployed app by product decision (Hive: "launched product off Cosine+, stay Next.js + Postgres"), not a personal skill.

## Decisions

- **Qdrant: not in this cut.** Nothing here is a nearest-neighbor problem; page content may not be embedded under the hard nos; the rule corpus is 75 typed records. If a retrieval need appears later (operator asking questions over tenant history), pgvector inside the existing Postgres comes before a second datastore.
- **Buildkite:** `.buildkite/pipeline.yml` mirrors the GitHub Actions jobs plus a pack byte-budget gate. No org or `bk` CLI is configured; it is a readable sketch, not a run.
- **Dogfood next:** put the pack on cosineautonomous.com. It is the one site Joe owns end to end and the lander already claims to recurse.

## Security (added 2026-09-09, second pass)

- **Two credentials, not one.** Registration now issues a private dashboard token (hashed at rest, only ever in the dashboard URL) and a public embed key (`sites.public_key`, plaintext, printed into the client's `<script src="/api/pack?key=…">`). The pack, `/api/beacon`, and `/api/resolve` accept the key only; the dashboard accepts the token only. Before this pass one string did both jobs, so every client page's HTML exposed its own dashboard. Anyone holding a public key can still post beacons for that site; that pollutes that tenant's own audits and nothing else. Migration `0003_public_key` backfills existing rows with a random key, so pre-split embeds must be re-copied from the dashboard (there are no tenants yet).
- **Client address.** `X-Forwarded-For` is read from the right behind `TRUSTED_PROXY_HOPS` trusted proxies, never from the caller-written first entry. Unset means zero: the header is ignored and every caller shares one bucket, which is correct for local dev and any direct exposure. Production opts in with the real proxy count (1 behind Vercel, Fly, or Cloudflare); forgetting it throttles registration to one shared bucket, which is visible, rather than opening a bypass. Registration is capped per address and globally (`REGISTER_GLOBAL_RATE`), because each registration triggers an outbound robots.txt read. Rate-limit buckets are swept when the map grows past a threshold.
- **Outbound fetch guard.** Before the server reads a registered host's policy files it resolves the hostname and refuses any answer that is loopback, private, link-local (cloud metadata), CGNAT, documentation, multicast, IPv6 ULA or link-local, or a v4-mapped private address; unresolvable hosts are recorded as `error`, never fetched. Residual: the resolution happens once per fetch, so a record that changes between check and connect (DNS rebinding) is not caught; pinning the connection to the checked address needs an agent-level hook and is out of this pass.
- **Response headers.** HSTS, a Content-Security-Policy (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`; `'unsafe-inline'` stays for Next's bootstrap and the example page, `'unsafe-eval'` only outside production), and `X-Robots-Tag: noindex, nofollow` on `/dashboard/*` and `/api/*`, with `robots` metadata on the dashboard page. Locked by `security-headers.test.ts`.
- **Still open.** Dashboard token lives in the URL path (history and logs); a cookie session is the next step if the product outgrows the wedge. Rate limits are per process. No dependency audit runs in CI yet.

## Hard nos (unchanged, enforced in code)

No cloud inference of page content. No DOM mutation beyond title and meta description. No cross-tenant learning or invented lift. No unauthenticated site listing. No secrets in git.

## Out of this pass

LLM-drafted fixes. Live Search Console. Per-path robots evaluation (root only). INP beyond the load window. Contrast and touch-target checks. WordPress / Shopify wrappers.
