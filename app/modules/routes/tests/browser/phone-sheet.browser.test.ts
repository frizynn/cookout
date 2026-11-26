import type { Locator, Page } from "@playwright/test";
import { PHONE, PHONE_USE, logInOnPhone } from "./phone.ts";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane } from "./regions.ts";
import { unique } from "./names.ts";

const NONE = 0;
const EDGE = 1;
const PILL_RADIUS = "24px";
const TEXT = "Morning! Who is looking at the flaky login test?";

interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
}

const NO_BOX: Box = { bottom: NONE, top: NONE, width: NONE };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) {
    return NO_BOX;
  }
  return { bottom: box.y + box.height, top: box.y, width: box.width };
}

async function channelWithAMessage(page: Page): Promise<Locator> {
  const channel = unique("browser-phone-sheet");
  await adminClient().createChannel({ name: channel });
  const author = await newIdentity({ kind: "human", name: unique("browser-phone-sheet-author") });
  await author.client.createMessage({ channel, text: TEXT });
  const { token } = await newIdentity({ kind: "human", name: unique("browser-phone-sheet-reader") });
  await logInOnPhone({ page, token, url: `/#/channels/${channel}` });
  return inPane(page).getByRole("article").filter({ hasText: TEXT });
}

test.use(PHONE_USE);

test("on a phone a message's More actions open as a sheet along the bottom, clear of the message", async ({ page }) => {
  const message = await channelWithAMessage(page);
  await message.getByText(TEXT, { exact: true }).tap();
  const text = await boxOf(message.getByText(TEXT, { exact: true }));
  await message.getByRole("button", { exact: true, name: "More actions" }).tap();
  const sheet = page.getByRole("menu");

  await expect(sheet.getByRole("menuitem", { exact: true, name: "Copy link" })).toBeVisible();

  const menu = await boxOf(sheet);

  expect(menu.width).toBe(PHONE.width);
  expect(Math.abs(menu.bottom - PHONE.height)).toBeLessThanOrEqual(EDGE);
  expect(menu.top).toBeGreaterThan(text.bottom);
});

test("on a phone the message box is a pill without the keyboard hint", async ({ page }) => {
  await channelWithAMessage(page);
  const form = inPane(page).getByRole("form", { exact: true, name: "Post to the channel" });

  await expect(form).toBeVisible();

  await expect(form).toHaveCSS("border-top-left-radius", PILL_RADIUS);
  await expect(
    inPane(page).getByText("Enter to send · Shift+Enter for a new line · @ to mention", { exact: true }),
  ).toBeHidden();
});

test("on a phone the tap that opens the message box's Post later sheet doesn't also pick the choice under the finger", async ({
  page,
}) => {
  await channelWithAMessage(page);
  const form = inPane(page).getByRole("form", { exact: true, name: "Post to the channel" });
  await form.getByRole("button", { exact: true, name: "Post later" }).tap();

  await expect(page.getByRole("menu").getByRole("menuitem", { exact: true, name: "Schedule…" })).toBeVisible();
  await expect(page.getByRole("dialog", { exact: true, name: "Schedule a message" })).toBeHidden();

  await page.getByRole("menuitem", { exact: true, name: "Schedule…" }).tap();

  await expect(page.getByRole("dialog", { exact: true, name: "Schedule a message" })).toBeVisible();
});
