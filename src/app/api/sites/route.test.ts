import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/sites", () => {
  it("does not list sites", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.sites).toBeUndefined();
    expect(Array.isArray(body)).toBe(false);
    expect(body).not.toHaveProperty("data");
  });
});
