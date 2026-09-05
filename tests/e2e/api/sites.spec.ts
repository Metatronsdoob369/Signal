import { expect, test } from "@playwright/test";

test.describe("GET /api/sites", () => {
  test("does not list sites", async ({ request }) => {
    const response = await request.get("/api/sites");
    expect(response.status()).toBe(405);
    const body = await response.json();
    expect(body.sites).toBeUndefined();
    expect(body).not.toHaveProperty("data");
    expect(body.success).toBe(false);
  });
});
