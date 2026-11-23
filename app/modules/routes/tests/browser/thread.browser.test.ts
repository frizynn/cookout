import { adminClient, logIn, newIdentity, sidebar } from "./people.ts";
import { expect, test } from "@playwright/test";
import type { Message } from "../../../sdk/index.ts";
import type { Page } from "@playwright/test";
import type { Person } from "./people.ts";

async function followedThread(channel: string, reader: Person): Promise<Message> {
  const admin = adminClient();
  await admin.createChannel({ name: channel });
  const { message: parent } = await admin.createMessage({ channel, text: "Who's on call?" });
  await reader.client.follow(parent.id);
  await admin.createMessage({ channel, replyTo: parent.id, text: "Not me" });
  return parent;
}

async function replyInThread(page: Page, channel: string, text: string): Promise<void> {
  await sidebar(page)
    .getByRole("link", { name: `#${channel}` })
    .click();
  await page.getByRole("article").filter({ hasText: "Who's on call?" }).getByRole("link", { name: "1 reply" }).click();
  await page.getByLabel("Reply", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send reply" }).click();
}

test("a human opens a thread, replies, and the thread leaves their inbox", async ({ page }) => {
  const reader = await newIdentity({ kind: "human", name: "browser-replier" });
  await followedThread("browser-thread", reader);
  const before = await reader.client.inbox();

  await logIn({ page, token: reader.token });
  await replyInThread(page, "browser-thread", "I am");

  await expect(page.getByRole("list", { name: "Replies" }).getByRole("article")).toContainText(["Not me", "I am"]);
  await expect
    .poll(async () => {
      const after = await reader.client.inbox();
      return [before.items.map((item) => item.message.text), after.items];
    })
    .toStrictEqual([["Not me"], []]);
});
