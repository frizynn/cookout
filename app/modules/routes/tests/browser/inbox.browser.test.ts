import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane, inSidebar } from "./regions.ts";
import type { MessageId } from "../../../sdk/index.ts";
import type { Person } from "./people.ts";
import { logInToChannels } from "./login.ts";

const ONE = 1;
const A_PAGE_AND_ONE = 51;
const ONE_PAGE = 50;

interface Reading {
  readonly poster: Person;
  readonly reader: Person;
}

async function openInbox(page: Page): Promise<void> {
  const streamOpen = page.waitForResponse((response) => response.url().includes("/v1/events"));
  await page.goto("/#/inbox");

  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();

  await streamOpen;
}

async function subscribedPerson(channel: string): Promise<Reading> {
  await adminClient().createChannel({ name: channel });
  const poster = await newIdentity({ kind: "agent", name: `${channel}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await reader.client.subscribe(channel);
  return { poster, reader };
}

function rows(page: Page, list: string): Locator {
  return page.getByRole("list", { name: list }).getByRole("listitem");
}

async function postFrom(poster: Person, channel: string, build: number): Promise<MessageId> {
  const { message } = await poster.client.createMessage({ channel, text: `Build ${String(build)} passed` });
  if (build === A_PAGE_AND_ONE) {
    return message.id;
  }
  const last = await postFrom(poster, channel, build + ONE);
  return last;
}

async function logInHavingRead(page: Page, channel: string): Promise<void> {
  const { poster, reader } = await subscribedPerson(channel);
  await reader.client.ack(await postFrom(poster, channel, ONE));
  await logInToChannels({ page, token: reader.token });
}

test("the inbox lists the identity's unread items for you, then activity, each leading with why", async ({ page }) => {
  const channel = "browser-inbox";
  const { poster, reader } = await subscribedPerson(channel);
  await poster.client.createMessage({ channel, text: "Deploy at noon?" });
  await poster.client.createMessage({ channel, text: `@${channel}-reader can you check the rollout?` });
  await logInToChannels({ page, token: reader.token });

  await inSidebar(page)
    .getByRole("link", { name: /^Inbox/u })
    .click();

  await expect(page.getByRole("heading", { level: 2, name: "For you 1" })).toBeVisible();
  await expect(rows(page, "For you")).toHaveText([
    `Mentioned you${channel}-posterposted in#${channel}just now@${channel}-reader can you check the rollout?`,
  ]);
  await expect(rows(page, "Activity")).toHaveText([
    `New in #${channel}${channel}-posterposted in#${channel}just nowDeploy at noon?`,
  ]);
  await expect(page.getByText("Nothing read yet.")).toBeVisible();
});

async function inboxInSecondTab(page: Page, channel: string): Promise<Page> {
  const { poster, reader } = await subscribedPerson(channel);
  await poster.client.createMessage({ channel, text: "Deploy at noon?" });
  await logInToChannels({ page, token: reader.token });
  const second = await page.context().newPage();
  await openInbox(second);
  return second;
}

async function openChannel(page: Page, channel: string, text: string): Promise<void> {
  await inSidebar(page)
    .getByRole("link", { name: new RegExp(`^#${channel}(?![a-z-])`, "u") })
    .click();

  await expect(page.getByRole("list", { name: "Messages" })).toContainText(text);
}

test("acking in one tab moves the item from Activity to Earlier in another", async ({ page }) => {
  const channel = "browser-inbox-tabs";
  const second = await inboxInSecondTab(page, channel);

  await expect(rows(second, "Activity")).toHaveCount(ONE);

  await openChannel(page, channel, "Deploy at noon?");

  await expect(second.getByText("You're all caught up.")).toBeVisible();
  await expect(rows(second, "Earlier")).toContainText(["Deploy at noon?"]);
});

test("Load more reads the next page of what was read, and the end says so", async ({ page }) => {
  await logInHavingRead(page, "browser-inbox-more");

  await expect(rows(page, "Earlier")).toHaveCount(ONE_PAGE);
  await expect(page.getByText("That's everything.")).toBeHidden();

  await inPane(page).getByRole("button", { name: "Load more" }).click();

  await expect(rows(page, "Earlier")).toHaveCount(A_PAGE_AND_ONE);
  await expect(rows(page, "Earlier").last()).toContainText("Build 1 passed");
  await expect(page.getByText("That's everything.")).toBeVisible();
  await expect(inPane(page).getByRole("button", { name: "Load more" })).toBeHidden();
});
