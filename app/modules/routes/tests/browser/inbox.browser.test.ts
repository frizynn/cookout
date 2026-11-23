import type { CookoutClient, IdentityKind } from "../../../sdk/index.ts";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createCookoutClient } from "../../../sdk/index.ts";

interface Person {
  readonly client: CookoutClient;
  readonly token: string;
}

interface Reading {
  readonly poster: Person;
  readonly reader: Person;
}

function adminClient(): CookoutClient {
  return createCookoutClient();
}

async function newIdentity(name: string, kind: IdentityKind): Promise<Person> {
  const { token } = await adminClient().createIdentity({ kind, name });
  return { client: createCookoutClient({ token }), token };
}

async function logIn(page: Page, token: string): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Token").fill(token);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("list", { name: "Channels" })).toBeVisible();
}

async function openInbox(page: Page): Promise<void> {
  const streamOpen = page.waitForResponse((response) => response.url().includes("/v1/events"));
  await page.goto("/#/inbox");

  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

  await streamOpen;
}

async function subscribedReader(channel: string): Promise<Reading> {
  await adminClient().createChannel({ name: channel });
  const poster = await newIdentity(`${channel}-poster`, "agent");
  const reader = await newIdentity(`${channel}-reader`, "human");
  await reader.client.subscribe(channel);
  return { poster, reader };
}

function countsRow(page: Page, channel: string): Locator {
  return page
    .getByRole("list", { name: "Unread by channel" })
    .getByRole("link", { name: new RegExp(`^#${channel}(?![a-z-])`, "u") });
}

test("the inbox lists the identity's inbox items with their reasons, and each channel's unread counts", async ({
  page,
}) => {
  const channel = "browser-inbox";
  const { poster, reader } = await subscribedReader(channel);
  await poster.client.createMessage({ channel, text: "Deploy at noon?" });
  await poster.client.createMessage({ channel, text: `@${channel}-reader can you check the rollout?` });
  await logIn(page, reader.token);

  await page.getByRole("banner").getByRole("link", { name: "Inbox" }).click();

  await expect(page.getByRole("list", { name: "Inbox" }).getByRole("link")).toHaveText([
    `#${channel}Subscribed channel@${channel}-posterDeploy at noon?`,
    `#${channel}Mention, Subscribed channel@${channel}-poster@${channel}-reader can you check the rollout?`,
  ]);
  await expect(countsRow(page, channel)).toHaveAccessibleName(`#${channel} 1 unread 1 mention`);
});

async function inboxInSecondTab(page: Page, channel: string): Promise<Page> {
  const { poster, reader } = await subscribedReader(channel);
  await poster.client.createMessage({ channel, text: "Deploy at noon?" });
  await logIn(page, reader.token);
  const second = await page.context().newPage();
  await openInbox(second);
  return second;
}

async function openChannel(page: Page, channel: string, text: string): Promise<void> {
  await page.getByRole("link", { name: new RegExp(`^#${channel}(?![a-z-])`, "u") }).click();

  await expect(page.getByRole("list", { name: "Messages" })).toContainText(text);
}

test("acking in one tab clears the count in another", async ({ page }) => {
  const channel = "browser-inbox-tabs";
  const second = await inboxInSecondTab(page, channel);

  await expect(countsRow(second, channel)).toHaveAccessibleName(`#${channel} 1 unread`);

  await openChannel(page, channel, "Deploy at noon?");

  await expect(countsRow(second, channel)).toBeHidden();
  await expect(second.getByRole("list", { name: "Inbox" })).toBeHidden();
  await expect(second.getByText("Nothing unread.")).toBeVisible();
});
