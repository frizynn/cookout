import type { CookoutClient, IdentityKind, Message } from "../../../sdk/index.ts";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createCookoutClient } from "../../../sdk/index.ts";

interface Person {
  readonly client: CookoutClient;
  readonly token: string;
}

interface Posted {
  readonly parent: Message;
  readonly poster: Person;
}

function adminClient(): CookoutClient {
  return createCookoutClient();
}

async function newIdentity(name: string, kind: IdentityKind): Promise<Person> {
  const { token } = await adminClient().createIdentity({ kind, name });
  return { client: createCookoutClient({ token }), token };
}

async function logInWithStream(page: Page, token: string): Promise<void> {
  const streamOpen = page.waitForResponse((response) => response.url().includes("/v1/events"));
  await page.goto("/");
  await page.getByLabel("Token").fill(token);
  await page.getByRole("button", { name: "Log in" }).click();
  await streamOpen;
}

async function openChannel(page: Page, channel: string): Promise<Posted> {
  await adminClient().createChannel({ name: channel });
  const poster = await newIdentity("browser-live-poster", "agent");
  const { message: parent } = await poster.client.createMessage({ channel, text: "Deploy at noon?" });
  const reader = await newIdentity("browser-live-reader", "human");
  await logInWithStream(page, reader.token);
  await page.getByRole("link", { name: `#${channel}` }).click();
  return { parent, poster };
}

test("a message posted by another identity appears in the open channel and thread without a reload", async ({
  page,
}) => {
  const channel = "browser-live";
  const { parent, poster } = await openChannel(page, channel);

  await expect(page.getByRole("list", { name: "Messages" }).getByRole("link")).toHaveText([
    "@browser-live-posterDeploy at noon?0 replies",
  ]);

  await poster.client.createMessage({ channel, text: "Or at one?" });
  await poster.client.createMessage({ channel, replyTo: parent.id, text: "Noon works" });

  await expect(page.getByRole("list", { name: "Messages" }).getByRole("link")).toHaveText([
    "@browser-live-posterDeploy at noon?1 reply",
    "@browser-live-posterOr at one?0 replies",
  ]);

  await page.getByRole("link", { name: /Deploy at noon\?/u }).click();

  await expect(page.getByRole("list", { name: "Replies" })).toContainText("Noon works");

  await poster.client.createMessage({ channel, replyTo: parent.id, text: "Then noon it is" });

  await expect(page.getByRole("list", { name: "Replies" }).getByRole("listitem")).toHaveText([
    "@browser-live-posterNoon works",
    "@browser-live-posterThen noon it is",
  ]);
});
