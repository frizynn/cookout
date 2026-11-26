import type { Browser, Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { test as base, expect } from "@playwright/test";
import { inConversation, inPane } from "./regions.ts";
import { logIn, logInToChannels, logInWithStream } from "./login.ts";
import type { Person } from "./people.ts";
import { probeFixtures } from "./probe.ts";
import { unique } from "./names.ts";

const test = base.extend(probeFixtures);

const NARROW = { height: 900, width: 600 };
const ONE_LINE_AND_A_HALF = 30;

async function mentionedInThread(channel: string): Promise<Person> {
  await adminClient().createChannel({ name: channel });
  const poster = await newIdentity({ kind: "agent", name: `${channel}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await reader.client.subscribe(channel);
  const { message: parent } = await poster.client.createMessage({ channel, text: "Deploy at noon?" });
  await poster.client.createMessage({
    channel,
    replyTo: parent.id,
    text: `@${channel}-reader can you check the rollout?`,
  });
  return reader;
}

async function narrowInbox(page: Page, channel: string): Promise<void> {
  const reader = await mentionedInThread(channel);
  await logInToChannels({ page, token: reader.token });
  await page.setViewportSize(NARROW);
  await page.goto("/#/inbox");
}

test("at 600 px wide, selecting a thread row shows only its conversation, and the back arrow returns to the list", async ({
  page,
}) => {
  await narrowInbox(page, unique("browser-inbox-narrow"));
  await inPane(page)
    .getByRole("list", { exact: true, name: "For you" })
    .getByRole("link")
    .filter({ has: page.getByText("Mentioned you", { exact: true }) })
    .click();

  await expect(inConversation(page)).toContainText("can you check the rollout?");
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Inbox" })).toBeHidden();

  await inConversation(page).getByRole("link", { exact: true, name: "Back to the inbox" }).click();

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Inbox" })).toBeVisible();
  await expect(inConversation(page)).toBeHidden();
  await expect(page).toHaveURL(/#\/inbox$/u);
});

async function pickMention(page: Page): Promise<void> {
  await inPane(page)
    .getByRole("list", { exact: true, name: "For you" })
    .getByRole("link")
    .filter({ has: page.getByText("Mentioned you", { exact: true }) })
    .click();
}

async function mentionOpened(page: Page, channel: string): Promise<void> {
  const reader = await mentionedInThread(channel);
  await logInToChannels({ page, token: reader.token });
  await page.goto("/#/inbox");
  await pickMention(page);
}

async function widthOf(page: Page): Promise<number> {
  const box = await inConversation(page).boundingBox();
  if (box === null) {
    return Number.NaN;
  }
  return box.width;
}

async function heightOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) {
    return Number.NaN;
  }
  return box.height;
}

test("on a wide screen the conversation beside the inbox keeps its width when a thread row is picked", async ({
  page,
}) => {
  const reader = await mentionedInThread(unique("browser-inbox-width"));
  await logInToChannels({ page, token: reader.token });
  await page.goto("/#/inbox");

  await expect(inConversation(page)).toContainText("Pick a conversation");

  const empty = await widthOf(page);
  await pickMention(page);

  await expect(inConversation(page)).toContainText("can you check the rollout?");

  expect(await widthOf(page)).toBe(empty);
});

test("on a wide screen the conversation's header buttons and Open thread each stay one line high", async ({ page }) => {
  await mentionOpened(page, unique("browser-inbox-header"));
  const header = inConversation(page).locator("header").first();
  const open = header.getByRole("link", { exact: true, name: "Open thread" });

  await expect(open).toBeVisible();

  const button = await heightOf(header.getByRole("button").first());
  const link = await heightOf(open);

  expect(button).toBe(link);
  expect(link).toBeLessThan(ONE_LINE_AND_A_HALF);
});

async function postFromElsewhere(browser: Browser, poster: Person, channel: string): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await logIn({ page, token: poster.token, url: `/#/channels/${channel}` });
  await page.getByLabel("Message", { exact: true }).fill("Rolled out to everyone");
  await inPane(page).getByRole("button", { exact: true, name: "Send" }).click();

  await expect(page.getByRole("feed", { exact: true, name: "Messages" })).toContainText("Rolled out to everyone");

  await context.close();
}

test("a post from another identity appears live in the open channel conversation", async ({ browser, page }) => {
  const channel = unique("browser-inbox-channel-live");
  await adminClient().createChannel({ name: channel });
  const poster = await newIdentity({ kind: "human", name: `${channel}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await reader.client.subscribe(channel);
  await poster.client.createMessage({ channel, text: "Rolling out 1.5" });
  await logInWithStream({ page, token: reader.token, url: `/#/inbox/${channel}` });

  await expect(inConversation(page)).toContainText("Rolling out 1.5");

  await postFromElsewhere(browser, poster, channel);

  await expect(
    inConversation(page).getByRole("feed", { exact: true, name: "Posts" }).getByRole("article"),
  ).toContainText(["Rolling out 1.5", "Rolled out to everyone"]);
});
