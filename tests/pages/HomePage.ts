import type { Locator, Page } from "@playwright/test";

export class HomePage {
  readonly page: Page;
  readonly domainInput: Locator;
  readonly nameInput: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.page = page;
    this.domainInput = page.getByTestId("domain-input");
    this.nameInput = page.getByTestId("name-input");
    this.submit = page.getByTestId("create-pack");
    this.error = page.getByTestId("register-error");
  }

  async goto() {
    await this.page.goto("/");
    await this.domainInput.waitFor({ state: "visible" });
  }

  async register(domain: string, name?: string) {
    await this.domainInput.fill(domain);
    if (name) await this.nameInput.fill(name);
    await this.submit.click();
  }
}
