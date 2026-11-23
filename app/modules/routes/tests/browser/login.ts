import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { inPane } from "./regions.ts";

export interface LogIn {
  readonly page: Page;
  readonly token: string;
  readonly url?: string;
}

export async function logIn({ page, token, url = "/" }: LogIn): Promise<void> {
  await page.goto(url);
  await page.getByLabel("Token").fill(token);
  await inPane(page).getByRole("button", { name: "Log in" }).click();
}

export async function logInToChannels(login: LogIn): Promise<void> {
  await logIn(login);

  await expect(login.page.getByRole("list", { name: "Channels" })).toBeVisible();
}

export async function logInWithStream(login: LogIn): Promise<void> {
  const streamOpen = login.page.waitForResponse((response) => response.url().includes("/v1/events"));
  await logIn(login);
  await streamOpen;
}
