import { describe, expect, it } from "vitest";
import { acceptVariant, fitDescription, fitTitle } from "./constraints";

describe("acceptVariant", () => {
  it("rejects an empty title", () => {
    expect(
      acceptVariant(
        "",
        "A meta description that is long enough to pass the one hundred character floor for Signal SEO.",
      ),
    ).toBe(false);
  });

  it("rejects a title over 60 characters", () => {
    expect(
      acceptVariant(
        "This title is deliberately far too long to pass the sixty character cap we enforce",
        "A meta description that is long enough to pass the one hundred character floor for Signal SEO.",
      ),
    ).toBe(false);
  });

  it("rejects a description under 100 characters", () => {
    expect(acceptVariant("Emergency plumber in Springfield", "Too short.")).toBe(false);
  });

  it("accepts a title and description inside Signal bounds", () => {
    expect(
      acceptVariant(
        "Emergency plumber in Springfield",
        "Need a plumber tonight? We cover Springfield 24/7 with licensed techs and same-hour arrival windows.",
      ),
    ).toBe(true);
  });
});

describe("fitTitle / fitDescription", () => {
  it("clamps a long title to 60 characters", () => {
    const fitted = fitTitle(
      "This title is deliberately far too long to pass the sixty character cap we enforce today",
    );
    expect(fitted.length).toBeLessThanOrEqual(60);
    expect(fitted.length).toBeGreaterThan(0);
  });

  it("pads a short description to at least 100 characters", () => {
    const fitted = fitDescription("Call us today.");
    expect(fitted.length).toBeGreaterThanOrEqual(100);
    expect(fitted.length).toBeLessThanOrEqual(160);
  });
});
