import { adminClient, logInWithStream, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import type { Message } from "../../../sdk/index.ts";
import type { Page } from "@playwright/test";
import type { Person } from "./people.ts";

interface Posted {
  readonly parent: Message;
  readonly poster: Person;
}

async function openChannel(page: Page, channel: string): Promise<Posted> {
  await adminClient().createChannel({ name: channel });
  const poster = await newIdentity({ kind: "agent", name: "browser-live-poster" });
  const { message: parent } = await poster.client.createMessage({ channel, text: "Deploy at noon?" });
  const reader = await newIdentity({ kind: "human", name: "browser-live-reader" });
  await logInWithStream({ page, token: reader.token });
  await page.getByRole("link", { name: `#${channel}` }).click();
  return { parent, poster };
}

test("a message posted by another identity appears in the open channel and thread without a reload", async ({
  page,
}) => {
  const channel = "browser-live";
  const { parent, poster } = await openChannel(page, channel);

  await expect(page.getByRole("list", { name: "Messages" }).getByRole("link")).toHaveText([
    "@browser-live-posteragentDeploy at noon?0 replies",
  ]);

  await poster.client.createMessage({ channel, text: "Or at one?" });
  await poster.client.createMessage({ channel, replyTo: parent.id, text: "Noon works" });

  await expect(page.getByRole("list", { name: "Messages" }).getByRole("link")).toHaveText([
    "@browser-live-posteragentDeploy at noon?1 reply",
    "@browser-live-posteragentOr at one?0 replies",
  ]);

  await page.getByRole("link", { name: /Deploy at noon\?/u }).click();

  await expect(page.getByRole("list", { name: "Replies" })).toContainText("Noon works");

  await poster.client.createMessage({ channel, replyTo: parent.id, text: "Then noon it is" });

  await expect(page.getByRole("list", { name: "Replies" }).getByRole("listitem")).toHaveText([
    "@browser-live-posteragentNoon works",
    "@browser-live-posteragentThen noon it is",
  ]);
});
