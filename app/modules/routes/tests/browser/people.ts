import type { CookoutClient, CreateIdentityRequest } from "../../../sdk/index.ts";
import type { Page } from "@playwright/test";
import { createCookoutClient } from "../../../sdk/index.ts";
import { expect } from "@playwright/test";

export interface Person {
  readonly client: CookoutClient;
  readonly token: string;
}

export interface LogIn {
  readonly page: Page;
  readonly token: string;
}

export function adminClient(): CookoutClient {
  return createCookoutClient();
}

export async function newIdentity(request: CreateIdentityRequest): Promise<Person> {
  const { token } = await adminClient().createIdentity(request);
  return { client: createCookoutClient({ token }), token };
}

export async function logIn({ page, token }: LogIn): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Token").fill(token);
  await page.getByRole("button", { name: "Log in" }).click();
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
