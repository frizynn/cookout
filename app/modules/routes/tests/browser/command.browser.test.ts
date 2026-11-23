import { adminClient, logInToChannels, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import type { CookoutClient } from "../../../sdk/index.ts";
import type { Page } from "@playwright/test";
import { createCookoutClient } from "../../../sdk/index.ts";

const schema = { properties: { branch: { type: "string" } }, required: ["branch"], type: "object" };
const nowhere = "http://127.0.0.1:9/command";
const NONE = 0;

async function channelWithCommand(channel: string, command: string): Promise<CookoutClient> {
  const admin = adminClient();
  await admin.createChannel({ name: channel });
  const { token } = await admin.createIdentity({ kind: "agent", name: command, owner: "admin" });
  await admin.addCommand({ name: command, schema, url: nowhere });
  return createCookoutClient({ token });
}

async function callFromTheForm(page: Page, command: string, data: string): Promise<void> {
  const form = page.getByRole("form", { name: "Call a command" });
  await form.getByLabel("Command").selectOption(command);
  await form.getByLabel("Data").fill(data);
  await form.getByRole("button", { name: "Call" }).click();
}

test("a command call and its result reply show their data", async ({ page }) => {
  const handler = await channelWithCommand("browser-command-shows", "browser-show-call");
  const { threadId } = await adminClient().callCommand("browser-show-call", {
    channel: "browser-command-shows",
    data: { branch: "main" },
  });
  await handler.createMessage({
    channel: "browser-command-shows",
    data: { status: "done" },
    replyTo: threadId,
    text: "Shipped main.",
  });

  const { token } = await newIdentity({ kind: "human", name: "browser-command-reader" });
  await logInToChannels({ page, token });
  await page.goto(`/#/channels/browser-command-shows/threads/${String(threadId)}`);

  await expect(
    page.getByRole("article", { name: "Parent message" }).getByLabel("Call to /browser-show-call"),
  ).toHaveText(JSON.stringify({ branch: "main" }));
  await expect(page.getByRole("list", { name: "Replies" }).getByRole("article")).toContainText(["Shipped main."]);
});

test("a person calls a command from the UI, and bad data shows the schema errors", async ({ page }) => {
  await channelWithCommand("browser-command-call", "browser-call-form");

  const { token } = await newIdentity({ kind: "human", name: "browser-command-caller" });
  await logInToChannels({ page, token });
  await page.getByRole("link", { name: "#browser-command-call" }).click();
  await callFromTheForm(page, "browser-call-form", '{"branch":1}');

  await expect(page.getByRole("alert")).toContainText("Couldn't call /browser-call-form (invalid_request)");
  await expect(page.getByRole("list", { name: "Schema errors" }).getByRole("listitem")).toHaveText([
    "data.branch: must be string",
  ]);

  await callFromTheForm(page, "browser-call-form", '{"branch":"main"}');

  await expect(page.getByRole("list", { name: "Messages" }).getByRole("article")).toContainText([
    `/browser-call-form${JSON.stringify({ branch: "main" })}`,
  ]);
  await expect(page.getByRole("alert")).toHaveCount(NONE);
});
