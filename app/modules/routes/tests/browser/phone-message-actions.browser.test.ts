import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane } from "./regions.ts";
import { logIn } from "./login.ts";
import { unique } from "./names.ts";

const PHONE = { height: 844, width: 390 };
const NONE = 0;
const TEXT = "Morning! Who is looking at the flaky login test?";

interface Span {
  readonly top: number;
  readonly bottom: number;
}

async function spanOf(locator: Locator): Promise<Span> {
  const box = await locator.boundingBox();
  if (box === null) {
    return { bottom: NONE, top: NONE };
  }
  return { bottom: box.y + box.height, top: box.y };
}

function authorName(): string {
  return unique("browser-phone-actions-author");
}

async function tappedMessage(page: Page): Promise<Locator> {
  const channel = unique("browser-phone-actions");
  await adminClient().createChannel({ name: channel });
  const author = await newIdentity({ kind: "human", name: authorName() });
  await author.client.createMessage({ channel, text: TEXT });
  const { token } = await newIdentity({ kind: "human", name: unique("browser-phone-actions-reader") });
  await logIn({ page, token, url: `/#/channels/${channel}` });
  const message = inPane(page).getByRole("article").filter({ hasText: TEXT });
  await message.getByText(TEXT, { exact: true }).tap();
  return message;
}

test.use({ hasTouch: true, isMobile: true, viewport: PHONE });

test("on a phone a tapped message shows its actions under its text instead of over it", async ({ page }) => {
  const message = await tappedMessage(page);
  const actions = message.getByRole("group", { exact: true, name: "Quick actions" });

  await expect(actions.getByRole("button", { exact: true, name: "More actions" })).toBeVisible();

  const header = await spanOf(message.getByRole("link", { exact: true, name: authorName() }));
  const text = await spanOf(message.getByText(TEXT, { exact: true }));

  const bar = await spanOf(actions);

  expect(bar.top).toBeGreaterThanOrEqual(Math.max(header.bottom, text.bottom));
});
