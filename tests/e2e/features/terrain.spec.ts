import { expect, test } from "@playwright/test";
import { createSiteViaApi } from "../../fixtures/sites";
import { DashboardPage } from "../../pages/DashboardPage";
import { TerrainPage } from "../../pages/TerrainPage";

/**
 * The terrain dashboard (TERRAIN_DASHBOARD=1 on the e2e server). Ground forms only from pages on
 * the registered domain, served under their real origin, so this drives one cross-origin beacon
 * the same way the client-origin spec does.
 */
test.describe("Terrain", () => {
  test("shows no ground until a page on the domain is audited, then one hot or cold hill", async ({
    page,
    request,
    baseURL,
  }) => {
    const site = await createSiteViaApi(request, "E2E Terrain");
    const dashboard = new DashboardPage(page);
    const terrain = new TerrainPage(page);
    const origin = `https://${site.domain}`;

    await dashboard.goto(site.token);
    await dashboard.terrainLink.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/${site.token}/terrain$`));
    await expect(terrain.empty).toBeVisible();
    await expect(terrain.surface).toHaveCount(0);
    await expect(terrain.root).not.toContainText(/lift/i);

    const markup = await (await request.get("/example-client-page.html")).text();
    const clientHtml = markup
      .replace(/<script>(?:(?!<\/script>)[\s\S])*api\/pack(?:(?!<\/script>)[\s\S])*<\/script>/, "")
      .replace(
        "</body>",
        `<script defer src="${baseURL}/api/pack?key=${encodeURIComponent(site.publicKey)}"></script></body>`,
      );
    await page.route(`${origin}/**`, (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/") {
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: clientHtml });
      }
      return route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
    });
    const beacon = page.waitForResponse(
      (response) =>
        response.url().includes("/api/beacon") && response.request().method() === "POST" && response.ok(),
    );
    await page.goto(`${origin}/`);
    const body = (await (await beacon).json()) as { scope: string; scores: { overall: number } };
    expect(body.scope).toBe("site");

    // Whichever surface this browser can draw, the HUD reads the same deterministic numbers.
    await terrain.goto(site.token);
    await expect(terrain.empty).toHaveCount(0);
    await expect(terrain.surface).toHaveAttribute("data-mode", /^(scene|contour)$/);
    await expect(terrain.pointCount).toContainText("1 page");
    await expect(terrain.singular).toBeVisible();
    await expect(terrain.scoreOverall).toHaveText(String(Math.round(body.scores.overall)));
    await expect(terrain.scoreSeo).toHaveText(/^\d+$/);
    await expect(terrain.scoreAio).toHaveText(/^\d+$/);
    await expect(terrain.substance).toHaveText(/^0\.\d\d$/);
    await expect(terrain.fixes).toBeVisible();
    await expect(terrain.root).not.toContainText(/lift/i);
    const mode = await terrain.surface.getAttribute("data-mode");
    if (mode === "scene") {
      await expect(page.getByTestId("terrain-canvas").locator("canvas")).toBeVisible();
      await expect(terrain.chips).toHaveCount(1);
      await expect(terrain.chips).toContainText("/");
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: "artifacts/terrain-dashboard.png" });

    // The contour surface is always available and draws the same hill.
    await terrain.goto(site.token, "contour");
    await expect(terrain.surface).toHaveAttribute("data-mode", "contour");
    await expect(page.getByTestId("terrain-contour").locator("path")).not.toHaveCount(0);
    await page.screenshot({ path: "artifacts/terrain-dashboard-contour.png" });

    await terrain.back.click();
    await expect(dashboard.siteDomain).toHaveText(site.domain);
  });
});
