import { expect, test } from "@playwright/test";
import { createSiteViaApi } from "../../fixtures/sites";
import { DashboardPage } from "../../pages/DashboardPage";
import { ExampleClientPage } from "../../pages/ExampleClientPage";

test.describe("Audit loop", () => {
  test("the example page audits as a demo and never counts toward the site", async ({
    page,
    request,
  }) => {
    const site = await createSiteViaApi(request, "E2E Example Demo");
    const client = new ExampleClientPage(page);
    const dashboard = new DashboardPage(page);

    await client.goto(site.publicKey);

    await dashboard.goto(site.token);
    await expect(dashboard.siteDomain).toHaveText(site.domain);

    // The site itself has not been audited: no headline, no breakdown, no findings.
    await expect(dashboard.scoreOverall).toHaveText("—");
    await expect(dashboard.scoreSeo).toHaveText("—");
    await expect(dashboard.scoreAio).toHaveText("—");
    await expect(dashboard.headlineEmpty).toBeVisible();
    await expect(dashboard.findingsEmpty).toBeVisible();

    // The example page shows as a labeled demo with its own numbers.
    await expect(dashboard.exampleAudit).toBeVisible();
    await expect(dashboard.exampleScoreOverall).toHaveText(/^\d+$/);
    await expect(dashboard.auditsTable).toContainText("example page");

    // Experiments are off by default and the example path never seeds a board.
    await expect(dashboard.experimentsState).toContainText("Experiments: off");
    await expect(page.getByTestId("experiment-path")).toHaveCount(0);
    await page.screenshot({ path: "artifacts/audit-loop-dashboard.png", fullPage: true });
  });

  test("unknown dashboard tokens are not found", async ({ page }) => {
    const response = await page.goto("/dashboard/not-a-real-token");
    expect(response?.status()).toBe(404);
  });
});
