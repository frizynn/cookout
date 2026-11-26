import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane } from "./regions.ts";
import { logIn } from "./login.ts";
import { unique } from "./names.ts";

const PHONE = { height: 844, width: 390 };
const NONE = 0;
const ONE_LINE_OF_SMALL_TEXT = 20;
const DISPLAY_NAME = "Release triage agent";
const TEXT = "I am.";

async function heightOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) {
    return NONE;
  }
  return box.height;
}

async function channelWithAnAgent(page: Page): Promise<void> {
  const channel = unique("browser-phone-header");
  await adminClient().createChannel({ name: channel });
  const agent = await newIdentity({ displayName: DISPLAY_NAME, kind: "agent", name: unique("browser-phone-header") });
  await agent.client.createMessage({ channel, text: TEXT });
  const { token } = await newIdentity({ kind: "human", name: unique("browser-phone-header-reader") });
  await logIn({ page, token, url: `/#/channels/${channel}` });
}

test.use({ hasTouch: true, isMobile: true, viewport: PHONE });

test("on a phone a message header wraps whole parts onto a new line instead of breaking a long name", async ({
  page,
}) => {
  await channelWithAnAgent(page);
  const name = inPane(page)
    .getByRole("article")
    .filter({ hasText: TEXT })
    .getByRole("link", { exact: true, name: DISPLAY_NAME });

  await expect(name).toBeVisible();

  expect(await heightOf(name)).toBe(ONE_LINE_OF_SMALL_TEXT);
});
