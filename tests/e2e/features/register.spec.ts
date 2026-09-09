import { expect, test } from "@playwright/test";
import { uniqueDomain } from "../../fixtures/data";
import { DashboardPage } from "../../pages/DashboardPage";
import { HomePage } from "../../pages/HomePage";

test.describe("Register", () => {
  test("creates a token-scoped dashboard from the home form", async ({ page }) => {
    const home = new HomePage(page);
    const dashboard = new DashboardPage(page);
    const domain = uniqueDomain();

    await home.goto();
    await home.register(domain, "Playwright Plumbing");
    await page.waitForURL(/\/dashboard\/.+\?new=1/);

    await expect(dashboard.tokenBanner).toBeVisible();
    await expect(dashboard.siteDomain).toHaveText(domain);
    await expect(dashboard.embedCode).toContainText("/api/pack?key=");
    await expect(dashboard.embedCode).not.toContainText(await dashboard.siteToken.innerText());
    await expect(dashboard.experimentsEmpty).toBeVisible();
    await expect(dashboard.findingsEmpty).toBeVisible();
    await expect(dashboard.auditsEmpty).toBeVisible();
    await page.screenshot({ path: "artifacts/register-dashboard.png", fullPage: true });
  });

  test("rejects an invalid domain without creating a site", async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.register("not a domain");
    await expect(home.error).toBeVisible();
    await expect(page).toHaveURL("/");
  });
});
