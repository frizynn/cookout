import { PHONE_USE, logInOnPhone } from "./phone.ts";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane, inSidebar, inTopBar } from "./regions.ts";
import { unique } from "./names.ts";

const NONE = 0;
const MESSAGE_BOX = { exact: true, name: "Message" } as const;

function pageScrollTop(): number {
  return globalThis.scrollY;
}

test.use(PHONE_USE);

test("on a phone the login page waits for a tap before it opens the keyboard", async ({ page }) => {
  await page.goto("/");
  const field = page.getByLabel("Token", { exact: true });

  await expect(field).toBeVisible();
  await expect(field).not.toBeFocused();
  expect(await page.evaluate(pageScrollTop)).toBe(NONE);
});

test("on a phone opening a channel lands on its title, not in the message box", async ({ page }) => {
  const channel = unique("browser-phone-landing");
  await adminClient().createChannel({ name: channel });
  const reader = await newIdentity({ kind: "human", name: unique("browser-phone-landing-reader") });
  await reader.client.subscribe(channel);
  await logInOnPhone({ page, token: reader.token });
  await inTopBar(page).getByRole("button", { exact: true, name: "Open the sidebar" }).tap();
  await inSidebar(page)
    .getByRole("link", { exact: true, name: `#${channel}` })
    .tap();

  await expect(inPane(page).getByRole("heading", { exact: true, level: 1, name: `#${channel}` })).toBeFocused();
  await expect(inPane(page).getByRole("textbox", MESSAGE_BOX)).not.toBeFocused();
  expect(await page.evaluate(pageScrollTop)).toBe(NONE);
});
