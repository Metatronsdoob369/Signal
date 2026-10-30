# Site-scoped audits and a per-site experiments switch

Date: 2026-09-11. Found while dogfooding on cosineautonomous.com, the first real page to close the loop.

## Problem

The dashboard links Signal's example client page with a real site's embed key. The beacon accepts pages hosted on Signal's own origin so that demo works, and every audit overwrote the site's headline row. Two opens of the example page turned the lander's 83 / 80 / 57 into 98 / 100 / 100, and `/api/resolve` seeded a `/example-client-page.html` page with heuristic variants under the real site. Separately, the experiment loop rewrote the real page's `document.title` with a served variant on the second load, and nothing could keep it off a site.

## Rules

1. **Page scope.** `pageScope(url, siteDomain)` is `site` for the registered domain (with `www` and subdomains) and `app` for anything else the beacon binding admits, which is only Signal's own origin. Audits are stored for both. Only site-scope audits update `sites.*_score` and `last_audit_at`, head the dashboard, and feed the breakdown and the findings. App-scope audits show as a labeled "Example page audit" block and as `example page` rows in Recent audits. The dashboard reads the headline from the latest site-scope audit (`splitAuditsByScope`), so the `sites` columns are a cache, never the source.
2. **Experiments are opt-in per site.** `sites.experiments_enabled` (migration `0004_experiments_enabled`, default `false`; existing rows come up off). `/api/resolve` answers 404 "No variant" unless the site opted in and the requesting page is site-scope, judged from the `Origin` header; a request without `Origin` is the same-origin example page. The gate runs before `resolveVariant`, so app pages never seed `pages` or `variants`. Experiment-intent beacons are accepted and dropped (`recorded: 0`) under the same gate (`experimentsAllowed`). The switch is a token-gated server action on the dashboard.
3. **Beacon response carries `scope`** so a client or a test can tell which side of the boundary an audit landed on.

## Tests

- Unit: `pageScope`, `splitAuditsByScope`, `experimentsAllowed`.
- E2E `audit-loop.spec`: the example page audits as a demo; headline reads a dash, findings empty, experiments off, no board for the example path.
- E2E `client-origin.spec`: a client page served under its real `https://` origin via Playwright route interception loads the pack from Signal cross-origin. Asserts `Access-Control-Allow-Origin` equals the client origin and `Access-Control-Allow-Credentials` is `true` (the class of bug the same-origin example page cannot see), `scope: site`, numeric headline, experiments board for `/` after opting in. Chromium runs with its private/local network access features disabled so a public https page may fetch loopback; that is browser policy for the test host, not Signal behavior.

## Residuals

- Heuristic variant quality: `Best ${title}` lowercases the first letter of all-caps brands ("Best cOSINE+…"), and titles near the 60-character limit clip to "…". Off by default contains it; fix the generator separately.
- Sites polluted before this change: audits are classified at read time, so old app-scope audits drop out of the headline on their own. The `sites.*_score` cache stays stale until the next site-scope beacon (the local cosineautonomous.com row was reset by hand).
- Scope is judged from the beacon's page URL and the resolve's `Origin` header. Both are browser-controlled, and both are already limited by the binding check to the site's host or Signal's origin.
