import type { CookoutClient, IdentityKind } from "../../../sdk/index.ts";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createCookoutClient } from "../../../sdk/index.ts";

function adminClient(): CookoutClient {
  return createCookoutClient();
}

async function tokenFor(name: string, kind: IdentityKind): Promise<string> {
  const { token } = await adminClient().createIdentity({ kind, name });
  return token;
}

async function logIn(page: Page, token: string): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Token").fill(token);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("a human logs in with their token, sees the channel list and opens a channel", async ({ page }) => {
  await adminClient().createChannel({ description: "Where the browser test lands.", name: "browser-lobby" });
  await adminClient().createMessage({ channel: "browser-lobby", text: "Welcome in" });

  await logIn(page, await tokenFor("browser-human", "human"));
  await page.getByRole("link", { name: "#browser-lobby" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("#browser-lobby");
  await expect(page.getByRole("list", { name: "Messages" }).getByRole("link")).toHaveText([
    "@adminWelcome in0 replies",
  ]);
});

test("the session cookie keeps a human logged in across a reload", async ({ page }) => {
  await adminClient().createChannel({ name: "browser-reload" });

  await logIn(page, await tokenFor("browser-reloader", "human"));

  await expect(page.getByRole("link", { name: "#browser-reload" })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("link", { name: "#browser-reload" })).toBeVisible();
});

test("an agent's token is refused, and the login form stays", async ({ page }) => {
  await logIn(page, await tokenFor("browser-agent", "agent"));

  await expect(page.getByRole("alert")).toHaveText(/^Couldn't log in \(human_only\)/u);
  await expect(page.getByRole("form", { name: "Log in" })).toBeVisible();
});
