import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { logIn } from "./login.ts";

async function openChannel(page: Page, channel: string): Promise<void> {
  await adminClient().createChannel({ name: channel });
  await adminClient().createMessage({ channel, text: "Hover over me" });
  const { token } = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await logIn({ page, token });
  await page.goto(`/#/channels/${channel}`);
}

test("hovering a message shows its Reply button, which opens the thread with the cursor in the reply box", async ({
  page,
}) => {
  await openChannel(page, "browser-hover");
  const message = page.getByRole("list", { name: "Messages" }).getByRole("article");
  const reply = message.getByRole("link", { name: "Reply" });

  await expect(reply).toBeHidden();

  await expect(async () => {
    await message.hover();

    await expect(reply).toBeVisible({ timeout: 1000 });
  }).toPass();

  await reply.click();

  await expect(page.getByLabel("Reply", { exact: true })).toBeFocused();
});

test("tabbing to a message shows its Reply button", async ({ page }) => {
  await openChannel(page, "browser-tab");
  const message = page.getByRole("list", { name: "Messages" }).getByRole("article");
  const reply = message.getByRole("link", { name: "Reply" });

  await expect(reply).toBeHidden();

  await message.focus();

  await expect(reply).toBeVisible();
});
