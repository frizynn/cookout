import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { inPane } from "./regions.ts";
import { logIn } from "./login.ts";

async function openChannel(page: Page, channel: string): Promise<void> {
  await adminClient().createChannel({ name: channel });
  await adminClient().createMessage({ channel, text: "Hover over me" });
  const { token } = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await logIn({ page, token });
  await page.goto(`/#/channels/${channel}`);
}

test("hovering a thread in the channel shows its Close button, which closes the thread", async ({ page }) => {
  await openChannel(page, "browser-hover");
  const message = page.getByRole("list", { name: "Messages" }).getByRole("article");
  const closeThread = message.getByRole("button", { name: "Close thread" });

  await expect(closeThread).toBeHidden();

  await expect(async () => {
    await message.hover();

    await expect(closeThread).toBeVisible({ timeout: 1000 });
  }).toPass();

  await expect(closeThread).toHaveText("Close");
  await expect(message.getByRole("link", { name: "Reply" })).toBeHidden();

  await closeThread.click();

  await expect(inPane(page).getByRole("button", { name: "1 closed thread" })).toBeVisible();
});

test("tabbing to a thread in the channel shows its Close button", async ({ page }) => {
  await openChannel(page, "browser-tab");
  const message = page.getByRole("list", { name: "Messages" }).getByRole("article");
  const closeThread = message.getByRole("button", { name: "Close thread" });

  await expect(closeThread).toBeHidden();

  await message.focus();

  await expect(closeThread).toBeVisible();
});

test("Reply in a thread's More actions menu opens the thread with the cursor in the reply box", async ({ page }) => {
  await openChannel(page, "browser-hover-reply");
  const message = page.getByRole("list", { name: "Messages" }).getByRole("article");
  await message.hover();
  await message.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Reply" }).click();

  await expect(page.getByLabel("Reply", { exact: true })).toBeFocused();
});
