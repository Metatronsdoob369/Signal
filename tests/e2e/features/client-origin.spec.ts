import { expect, test } from "@playwright/test";
import { createSiteViaApi } from "../../fixtures/sites";
import { DashboardPage } from "../../pages/DashboardPage";

/**
 * A page on the registered domain, served under its real https origin (route interception),
 * loading the pack cross-origin from Signal. This is the path every real client page takes and
 * the one the same-origin example page cannot exercise: CORS with credentials, the tenant
 * binding, the headline, and experiments.
 */
test.describe("Client origin", () => {
  test("a page on the registered domain drives the headline and experiments over CORS", async ({
    page,
    request,
    baseURL,
  }) => {
    const site = await createSiteViaApi(request, "E2E Client Origin");
    const dashboard = new DashboardPage(page);
    const origin = `https://${site.domain}`;

    await dashboard.goto(site.token);
    await expect(dashboard.experimentsState).toContainText("Experiments: off");
    await dashboard.experimentsToggle.click();
    await expect(dashboard.experimentsState).toContainText("Experiments: on");

    // Reuse the example page's markup as the client page, but load the pack from Signal's
    // absolute origin: the page's own loader builds the URL from location.origin, which under
    // interception would point back at the client origin.
    const markup = await (await request.get("/example-client-page.html")).text();
    const clientHtml = markup
      .replace(/<script>(?:(?!<\/script>)[\s\S])*api\/pack(?:(?!<\/script>)[\s\S])*<\/script>/, "")
      .replace(
        "</body>",
        `<script defer src="${baseURL}/api/pack?key=${encodeURIComponent(site.publicKey)}"></script></body>`,
      );
    expect(clientHtml).toContain("/api/pack?key=");

    await page.route(`${origin}/**`, (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/") {
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: clientHtml });
      }
      return route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
    });

    const beacon = page.waitForResponse(async (response) => {
      if (!response.url().includes("/api/beacon") || response.request().method() !== "POST") return false;
      if (!response.ok()) return false;
      try {
        const body = (await response.json()) as { auditId?: string };
        return typeof body.auditId === "string";
      } catch {
        return false;
      }
    });
    await page.goto(`${origin}/`);
    const response = await beacon;

    // The browser only hands the response to the page when both headers are present.
    expect(response.headers()["access-control-allow-origin"]).toBe(origin);
    expect(response.headers()["access-control-allow-credentials"]).toBe("true");
    const body = (await response.json()) as { scope: string; scores: { overall: number } };
    expect(body.scope).toBe("site");
    expect(body.scores.overall).toBeGreaterThan(0);

    await dashboard.goto(site.token);
    await expect(dashboard.scoreOverall).toHaveText(/^\d+$/);
    await expect(dashboard.scoreSeo).toHaveText(/^\d+$/);
    await expect(dashboard.scoreAio).toHaveText(/^\d+$/);
    await expect(dashboard.findingsList).toBeVisible();
    await expect(dashboard.auditsTable).toContainText(`${origin}/`);
    await expect(page.getByTestId("experiment-path")).toHaveText("/");
    await expect(dashboard.experiments).not.toContainText(/lift/i);
    await page.screenshot({ path: "artifacts/client-origin-dashboard.png", fullPage: true });
  });
});
