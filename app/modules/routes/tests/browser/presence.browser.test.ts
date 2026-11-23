import type { Browser, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { logInWithStream } from "./login.ts";
import { newIdentity } from "./people.ts";

interface Viewing {
  readonly page: Page;
  readonly watched: string;
}

async function profileOf({ page, watched }: Viewing): Promise<Locator> {
  const viewer = await newIdentity({ kind: "human", name: `${watched}-viewer` });
  await logInWithStream({ page, token: viewer.token });
  await page.goto(`/#/people/${watched}`);
  return page.getByRole("complementary", { name: "Profile" });
}

async function tabOf(browser: Browser, token: string): Promise<() => Promise<void>> {
  const other = await browser.newContext();
  await logInWithStream({ page: await other.newPage(), token });
  return async () => {
    await other.close();
  };
}

test("a human whose tab opens shows online in another browser, and offline once it closes and the grace ends", async ({
  browser,
  page,
}) => {
  const watcher = await newIdentity({ kind: "human", name: "browser-presence-watcher" });
  const profile = await profileOf({ page, watched: "browser-presence-watcher" });

  await expect(profile.getByRole("img", { name: "browser-presence-watcher, Offline" })).toBeVisible();

  const closeTab = await tabOf(browser, watcher.token);

  await expect(profile.getByRole("img", { name: "browser-presence-watcher, Online" })).toBeVisible();
  await expect(profile.getByText("Online · web")).toBeVisible();

  await closeTab();

  await expect(profile.getByRole("img", { name: /^browser-presence-watcher, Offline, last seen /u })).toBeVisible();
  await expect(profile.getByText(/^Offline · last seen /u)).toBeVisible();
});
