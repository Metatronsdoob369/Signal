import type { Locator, Page } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;
  readonly tokenBanner: Locator;
  readonly siteToken: Locator;
  readonly siteDomain: Locator;
  readonly scoreOverall: Locator;
  readonly scoreSeo: Locator;
  readonly scoreAio: Locator;
  readonly embedCode: Locator;
  readonly exampleLink: Locator;
  readonly experiments: Locator;
  readonly experimentsEmpty: Locator;
  readonly experimentsBoard: Locator;
  readonly findingsEmpty: Locator;
  readonly findingsList: Locator;
  readonly auditsEmpty: Locator;
  readonly auditsTable: Locator;
  readonly headlineEmpty: Locator;
  readonly exampleAudit: Locator;
  readonly exampleScoreOverall: Locator;
  readonly experimentsToggle: Locator;
  readonly experimentsState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tokenBanner = page.getByTestId("token-created");
    this.siteToken = page.getByTestId("site-token");
    this.siteDomain = page.getByTestId("site-domain");
    this.scoreOverall = page.getByTestId("score-overall");
    this.scoreSeo = page.getByTestId("score-seo");
    this.scoreAio = page.getByTestId("score-aio");
    this.embedCode = page.getByTestId("embed-code");
    this.exampleLink = page.getByTestId("example-client-link");
    this.experiments = page.getByTestId("experiments");
    this.experimentsEmpty = page.getByTestId("experiments-empty");
    this.experimentsBoard = page.getByTestId("experiments-board");
    this.findingsEmpty = page.getByTestId("findings-empty");
    this.findingsList = page.getByTestId("findings-list");
    this.auditsEmpty = page.getByTestId("audits-empty");
    this.auditsTable = page.getByTestId("audits-table");
    this.headlineEmpty = page.getByTestId("headline-empty");
    this.exampleAudit = page.getByTestId("example-audit");
    this.exampleScoreOverall = page.getByTestId("example-score-overall");
    this.experimentsToggle = page.getByTestId("experiments-toggle");
    this.experimentsState = page.getByTestId("experiments-state");
  }

  async goto(token: string) {
    await this.page.goto(`/dashboard/${token}`);
    await this.siteDomain.waitFor({ state: "visible" });
  }
}
