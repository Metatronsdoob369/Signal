import type { APIRequestContext } from "@playwright/test";
import { uniqueDomain } from "../fixtures/data";

export type CreatedSite = {
  domain: string;
  token: string;
  dashboardUrl: string;
};

export async function createSiteViaApi(
  request: APIRequestContext,
  name = "E2E Site",
): Promise<CreatedSite> {
  const domain = uniqueDomain();
  const response = await request.post("/api/sites", {
    data: { domain, name },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create site: ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as {
    site: { token: string; dashboardUrl: string };
  };
  return { domain, token: body.site.token, dashboardUrl: body.site.dashboardUrl };
}
