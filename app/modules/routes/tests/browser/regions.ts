import type { Locator, Page } from "@playwright/test";

const SPECIAL = /[$()*+.?[\\\]^{|}]/gu;

interface Saying {
  readonly page: Page;
  readonly start: string;
}

export function inSidebar(page: Page): Locator {
  return page.getByRole("navigation", { name: "Sidebar" });
}

export function inPane(page: Page): Locator {
  return page.getByRole("main");
}

export function inThread(page: Page): Locator {
  return page.getByRole("complementary", { name: "Thread" });
}

export function inConversation(page: Page): Locator {
  return page.getByRole("complementary", { name: "Conversation" });
}

export function inProfile(page: Page): Locator {
  return page.getByRole("complementary", { name: "Profile" });
}

export function inTopBar(page: Page): Locator {
  return page.getByRole("banner", { name: "Top bar" });
}

export function inDialog(page: Page): Locator {
  return page.getByRole("alertdialog");
}

export function alertSaying({ page, start }: Saying): Locator {
  return page.getByRole("alert").filter({ hasText: new RegExp(`^${start.replaceAll(SPECIAL, String.raw`\$&`)}`, "u") });
}
