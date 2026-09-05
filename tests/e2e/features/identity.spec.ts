import { expect, test } from "@playwright/test";

test.describe("Signal identity", () => {
  test("home is Signal and has the register form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Signal").first()).toBeVisible();
    await expect(page.getByTestId("domain-input")).toBeVisible();
    await expect(page.getByText(/Cosine\+/)).toHaveCount(0);
  });

  test("unauthenticated /dashboard goes home", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("domain-input")).toBeVisible();
  });
});
