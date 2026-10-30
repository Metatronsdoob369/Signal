import type { PageScope } from "@/lib/tenant";

/**
 * Experiments (title and description variants served to visitors) run only for pages on the
 * registered domain of a site that switched them on. Signal's example page never qualifies.
 */
export function experimentsAllowed(
  site: { experimentsEnabled: boolean },
  scope: PageScope | null,
): boolean {
  return site.experimentsEnabled && scope === "site";
}
