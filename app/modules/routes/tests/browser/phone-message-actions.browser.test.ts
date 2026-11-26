import type { Locator, Page } from "@playwright/test";
import { PHONE_USE, liftFingerOver, logInOnPhone, pressAndHold } from "./phone.ts";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane } from "./regions.ts";
import { unique } from "./names.ts";

const TEXT = "Morning! Who is looking at the flaky login test?";

async function shownMessage(page: Page): Promise<Locator> {
  const channel = unique("browser-phone-actions");
  await adminClient().createChannel({ name: channel });
  const author = await newIdentity({ kind: "human", name: unique("browser-phone-actions-author") });
  await author.client.createMessage({ channel, text: TEXT });
  const { token } = await newIdentity({ kind: "human", name: unique("browser-phone-actions-reader") });
  await logInOnPhone({ page, token, url: `/#/channels/${channel}` });
  return inPane(page).getByRole("article").filter({ hasText: TEXT });
}

test.use(PHONE_USE);

test("on a phone a tapped message shows no bar of actions", async ({ page }) => {
  const message = await shownMessage(page);
  await message.getByText(TEXT, { exact: true }).tap();

  await expect(message.getByRole("group", { exact: true, name: "Quick actions" })).toBeHidden();
});

test("on a phone holding a finger on a message opens its actions, and lifting it over one doesn't pick it", async ({
  page,
}) => {
  const message = await shownMessage(page);
  await pressAndHold(message.getByText(TEXT, { exact: true }));
  const sheet = page.getByRole("menu");
  const copy = sheet.getByRole("menuitem", { exact: true, name: "Copy link" });

  await expect(copy).toBeVisible();

  await liftFingerOver(copy);

  await expect(copy).toBeVisible();
});
