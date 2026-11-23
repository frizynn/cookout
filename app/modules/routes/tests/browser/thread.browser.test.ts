import type { CookoutClient, Message } from "../../../sdk/index.ts";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createCookoutClient } from "../../../sdk/index.ts";

interface Reader {
  readonly client: CookoutClient;
  readonly token: string;
}

function adminClient(): CookoutClient {
  return createCookoutClient();
}

async function newHuman(name: string): Promise<Reader> {
  const { token } = await adminClient().createIdentity({ kind: "human", name });
  return { client: createCookoutClient({ token }), token };
}

async function followedThread(channel: string, reader: Reader): Promise<Message> {
  const admin = adminClient();
  await admin.createChannel({ name: channel });
  const { message: parent } = await admin.createMessage({ channel, text: "Who's on call?" });
  await reader.client.follow(parent.id);
  await admin.createMessage({ channel, replyTo: parent.id, text: "Not me" });
  return parent;
}

async function logIn(page: Page, token: string): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Token").fill(token);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function replyInThread(page: Page, channel: string, text: string): Promise<void> {
  await page.getByRole("link", { name: `#${channel}` }).click();
  await page.getByRole("link", { name: /Who's on call\?/u }).click();
  await page.getByLabel("Reply", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send reply" }).click();
}

test("a human opens a thread, replies, and the thread leaves their inbox", async ({ page }) => {
  const reader = await newHuman("browser-replier");
  await followedThread("browser-thread", reader);
  const before = await reader.client.inbox();

  await logIn(page, reader.token);
  await replyInThread(page, "browser-thread", "I am");

  await expect(page.getByRole("list", { name: "Replies" }).getByRole("listitem")).toHaveText([
    "@adminNot me",
    "@browser-replierI am",
  ]);
  await expect
    .poll(async () => {
      const after = await reader.client.inbox();
      return [before.items.map((item) => item.message.text), after.items];
    })
    .toStrictEqual([["Not me"], []]);
});
