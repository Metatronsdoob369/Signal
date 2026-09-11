import { describe, expect, it } from "vitest";
import { splitAuditsByScope } from "@/lib/audit-scope";

const site = "cosineautonomous.com";
const newestFirst = [
  { id: "3", url: "http://localhost:3010/example-client-page.html?key=k" },
  { id: "2", url: "http://localhost:3010/example-client-page.html?key=k" },
  { id: "1", url: "https://cosineautonomous.com/" },
];

describe("splitAuditsByScope", () => {
  it("keeps the newest site-scope audit as the headline even when example-page audits are newer", () => {
    const split = splitAuditsByScope(newestFirst, site);
    expect(split.latestSite?.id).toBe("1");
    expect(split.latestApp?.id).toBe("3");
    expect(split.site.map((a) => a.id)).toEqual(["1"]);
    expect(split.app.map((a) => a.id)).toEqual(["3", "2"]);
  });

  it("reports no headline when only example-page audits exist", () => {
    const split = splitAuditsByScope(newestFirst.slice(0, 2), site);
    expect(split.latestSite).toBeNull();
    expect(split.latestApp?.id).toBe("3");
  });

  it("treats an unparseable URL as app scope so it can never become the headline", () => {
    const split = splitAuditsByScope([{ id: "x", url: "garbage" }], site);
    expect(split.latestSite).toBeNull();
    expect(split.app).toHaveLength(1);
  });
});
