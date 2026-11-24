import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inConversation, inPane } from "./regions.ts";
import type { Page } from "@playwright/test";
import type { Person } from "./people.ts";
import { logInToChannels } from "./login.ts";

const NARROW = { height: 900, width: 600 };

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
  await narrowInbox(page, "browser-inbox-narrow");
  await inPane(page)
    .getByRole("list", { name: "For you" })
    .getByRole("link", { name: /Mentioned you/u })
    .click();

  await expect(inConversation(page)).toContainText("can you check the rollout?");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeHidden();

  await inConversation(page).getByRole("link", { name: "Back to the inbox" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
  await expect(inConversation(page)).toBeHidden();
  await expect(page).toHaveURL(/#\/inbox$/u);
});
