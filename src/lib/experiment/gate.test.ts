import { describe, expect, it } from "vitest";
import { experimentsAllowed } from "@/lib/experiment/gate";

describe("experimentsAllowed", () => {
  it("serves and records experiments only for site-scope pages of a site that opted in", () => {
    expect(experimentsAllowed({ experimentsEnabled: true }, "site")).toBe(true);
  });

  it("refuses when the site has experiments off", () => {
    expect(experimentsAllowed({ experimentsEnabled: false }, "site")).toBe(false);
  });

  it("refuses app-scope pages such as the example page even when the site opted in", () => {
    expect(experimentsAllowed({ experimentsEnabled: true }, "app")).toBe(false);
    expect(experimentsAllowed({ experimentsEnabled: true }, null)).toBe(false);
  });
});
