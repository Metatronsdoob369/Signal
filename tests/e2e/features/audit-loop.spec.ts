import { expect, test } from "@playwright/test";
import { createSiteViaApi } from "../../fixtures/sites";
import { DashboardPage } from "../../pages/DashboardPage";
import { ExampleClientPage } from "../../pages/ExampleClientPage";

test.describe("Audit loop", () => {
  test("embed scores a page and seeds experiments on the same dashboard", async ({
    page,
    request,
  }) => {
    const site = await createSiteViaApi(request, "E2E Audit Loop");
    const client = new ExampleClientPage(page);
    const dashboard = new DashboardPage(page);

    await client.goto(site.publicKey);

    await dashboard.goto(site.token);
    await expect(dashboard.siteDomain).toHaveText(site.domain);
    await expect(dashboard.scoreSeo).not.toHaveText("0");
    await expect(dashboard.scoreAio).not.toHaveText("0");
    await expect(dashboard.findingsList).toBeVisible();
    await expect(dashboard.auditsTable).toBeVisible();
    await expect(dashboard.experimentsBoard).toBeVisible();
    await expect(page.getByTestId("experiment-path")).toHaveText("/example-client-page.html");
    await expect(dashboard.experiments).not.toContainText(/lift/i);
    await page.screenshot({ path: "artifacts/audit-loop-dashboard.png", fullPage: true });
  });

  test("unknown dashboard tokens are not found", async ({ page }) => {
    const response = await page.goto("/dashboard/not-a-real-token");
    expect(response?.status()).toBe(404);
  });
});
