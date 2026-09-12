/** The terrain dashboard ships dark: the route exists only when TERRAIN_DASHBOARD=1. */
export function terrainDashboardEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.TERRAIN_DASHBOARD === "1";
}
