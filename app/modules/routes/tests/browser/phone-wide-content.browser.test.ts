import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inThread } from "./regions.ts";
import { logIn } from "./login.ts";
import { unique } from "./names.ts";

const PHONE = { height: 844, width: 390 };
const NONE = 0;
const WIDE_TABLE = [
  "| step | status | duration | runner | notes |",
  "|------|--------|----------|--------|-------|",
  "| build | ok | 42s | ubuntu-latest-8-cores | cached dependencies from the previous run |",
  "| migrate | failed | 3s | ubuntu-latest-8-cores | database locked by another process |",
].join("\n");

async function rightEdgeOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) {
    return NONE;
  }
  return box.x + box.width;
}

async function threadWithTable(page: Page): Promise<void> {
  const channel = unique("browser-phone-wide");
  await adminClient().createChannel({ name: channel });
  const { message } = await adminClient().createMessage({ channel, text: "Why did the deploy fail?" });
  const agent = await newIdentity({ kind: "agent", name: unique("browser-phone-wide-agent") });
  await agent.client.createMessage({ channel, replyTo: message.id, text: WIDE_TABLE });
  const { token } = await newIdentity({ kind: "human", name: unique("browser-phone-wide-reader") });
  await logIn({ page, token, url: `/#/channels/${channel}/threads/${String(message.id)}` });
}

test.use({ hasTouch: true, isMobile: true, viewport: PHONE });

test("on a phone a wide table in a reply scrolls inside the reply instead of running off the thread", async ({
  page,
}) => {
  await threadWithTable(page);
  const table = inThread(page).getByRole("table");
  const lastCell = table.getByRole("cell", { exact: true, name: "database locked by another process" });

  await expect(table).toBeVisible();

  expect(await rightEdgeOf(table)).toBeLessThanOrEqual(await rightEdgeOf(inThread(page)));

  await lastCell.scrollIntoViewIfNeeded();

  expect(await rightEdgeOf(lastCell)).toBeLessThanOrEqual(await rightEdgeOf(inThread(page)));
});
