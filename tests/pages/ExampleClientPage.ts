import type { Page, Response } from "@playwright/test";

export class ExampleClientPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(key: string) {
    const resolve = this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/resolve") &&
        response.request().method() === "GET" &&
        response.ok(),
    );
    const beacon = this.page.waitForResponse((response) => this.isAuditBeacon(response));
    await this.page.goto(`/example-client-page.html?key=${encodeURIComponent(key)}`);
    await this.page.getByRole("heading", { name: /Signal example client page/i }).waitFor({
      state: "visible",
    });
    await Promise.all([resolve, beacon]);
  }

  private async isAuditBeacon(response: Response): Promise<boolean> {
    if (!response.url().includes("/api/beacon") || response.request().method() !== "POST") {
      return false;
    }
    if (!response.ok()) return false;
    try {
      const body = (await response.json()) as { auditId?: string };
      return typeof body.auditId === "string";
    } catch {
      return false;
    }
  }
}
