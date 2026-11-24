import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane, inThread } from "./regions.ts";
import type { Page } from "@playwright/test";
import type { Person } from "./people.ts";
import type { TopLevelMessage } from "../../../sdk/index.ts";
import { logIn } from "./login.ts";

const NUDGE = "Quiet for 3 days: close it, or follow up?";

interface Started {
  readonly starter: Person;
  readonly parent: TopLevelMessage;
}

async function threadStarted(channel: string): Promise<Started> {
  await adminClient().createChannel({ name: channel });
  const starter = await newIdentity({ kind: "human", name: `${channel}-starter` });
  const { message } = await starter.client.createMessage({ channel, text: "Who owns the release notes?" });
  if (message.kind !== "top-level") {
    throw new TypeError("a new message in a channel is top-level");
  }
  return { parent: message, starter };
}

async function nudgedOn(page: Page, { parent, starter }: Started): Promise<void> {
  const { channels } = await starter.client.listChannels();
  const channel = channels.find(({ name }) => name === parent.channel);
  const nudge = { channel, id: 1, kind: "first", parent, raisedAt: parent.createdAt, text: NUDGE };
  await page.route("**/v1/inbox", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({ body: body.replace('"nudges":[]', `"nudges":[${JSON.stringify(nudge)}]`), response });
  });
}

test("a nudge row's link opens its thread", async ({ page }) => {
  const started = await threadStarted("browser-nudges");
  await nudgedOn(page, started);
  await logIn({ page, token: started.starter.token, url: "/#/inbox" });

  await inPane(page)
    .getByRole("list", { name: "For you" })
    .getByRole("link", { name: new RegExp(NUDGE.replace("?", String.raw`\?`), "u") })
    .click();

  await expect(page).toHaveURL(new RegExp(`#/channels/browser-nudges/threads/${String(started.parent.id)}$`, "u"));
  await expect(inThread(page)).toContainText("Who owns the release notes?");
});
