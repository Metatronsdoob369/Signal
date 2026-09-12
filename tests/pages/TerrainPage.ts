import type { Locator, Page } from "@playwright/test";

export class TerrainPage {
  readonly page: Page;
  readonly root: Locator;
  readonly surface: Locator;
  readonly empty: Locator;
  readonly pointCount: Locator;
  readonly singular: Locator;
  readonly scoreOverall: Locator;
  readonly scoreSeo: Locator;
  readonly scoreAio: Locator;
  readonly substance: Locator;
  readonly fixes: Locator;
  readonly back: Locator;
  readonly chips: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId("terrain-root");
    this.surface = page.getByTestId("terrain-surface");
    this.empty = page.getByTestId("terrain-empty");
    this.pointCount = page.getByTestId("terrain-point-count");
    this.singular = page.getByTestId("terrain-singular");
    this.scoreOverall = page.getByTestId("terrain-score-overall");
    this.scoreSeo = page.getByTestId("terrain-score-seo");
    this.scoreAio = page.getByTestId("terrain-score-aio");
    this.substance = page.getByTestId("terrain-substance");
    this.fixes = page.getByTestId("terrain-fixes");
    this.back = page.getByTestId("terrain-back");
    this.chips = page.getByTestId("terrain-chip");
  }

  async goto(token: string, view?: "scene" | "contour") {
    await this.page.goto(`/dashboard/${token}/terrain${view ? `?view=${view}` : ""}`);
    await this.root.waitFor({ state: "visible" });
  }
}
