import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane, inThread } from "./regions.ts";
import { logIn } from "./login.ts";
import { unique } from "./names.ts";

const PHONE = { height: 844, width: 390 };
const HALF = 2;
const NONE = 0;
const THREAD = "[aria-label='Thread']";

async function threadOverItsChannel(page: Page): Promise<void> {
  const channel = unique("browser-phone-cover");
  await adminClient().createChannel({ name: channel });
  const { message } = await adminClient().createMessage({ channel, text: "Who can look at the flaky test?" });
  const replier = await newIdentity({ kind: "agent", name: unique("browser-phone-cover-agent") });
  await replier.client.createMessage({ channel, replyTo: message.id, text: "On it." });
  const { token } = await newIdentity({ kind: "human", name: unique("browser-phone-cover-reader") });
  await logIn({ page, token, url: `/#/channels/${channel}/threads/${String(message.id)}` });
}

type Point = readonly [number, number];

interface Looking {
  readonly at: Point;
  readonly selector: string;
}

function coveredBy({ at, selector }: Looking): boolean {
  const cover = document.querySelector(selector);
  if (cover === null) {
    return false;
  }
  const [left, top] = at;
  return cover.contains(document.elementFromPoint(left, top));
}

async function middleOf(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (box === null) {
    return [NONE, NONE];
  }
  return [box.x + box.width / HALF, box.y + box.height / HALF];
}

test.use({ hasTouch: true, isMobile: true, viewport: PHONE });

test("on a phone the thread panel covers the replier faces of the channel under it", async ({ page }) => {
  await threadOverItsChannel(page);
  const face = inPane(page).getByTestId("replier-avatar").first();

  await expect(inThread(page)).toContainText("On it.");

  const at = await middleOf(face);

  expect(await page.evaluate(coveredBy, { at, selector: THREAD })).toBe(true);
});
