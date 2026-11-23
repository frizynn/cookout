import { adminClient, alertSaying, newIdentity, openAt } from "./app.tsx";
import { expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import type { CookoutClient } from "../../sdk/index.ts";
import { watched } from "./watched.ts";

const NONE = 0;

type InboxEntry = readonly [string, readonly string[]];

async function channelWith(name: string, text: string): Promise<void> {
  await adminClient().createChannel({ name });
  await adminClient().createMessage({ channel: name, text });
}

async function shownMessages(): Promise<readonly (string | null)[]> {
  const list = await screen.findByRole("list", { name: "Messages" });
  const shown: (string | null)[] = [];
  for (const item of within(list).getAllByRole("listitem")) {
    shown.push(item.textContent);
  }
  return shown;
}

async function inboxOf(client: CookoutClient): Promise<readonly InboxEntry[]> {
  const { items } = await client.inbox();
  return items.map((item) => [item.message.text, item.reasons] as const);
}

async function inboxOnceFilled(client: CookoutClient): Promise<readonly InboxEntry[]> {
  const entries = await vi.waitUntil(async () => {
    const found = await inboxOf(client);
    return found.length > NONE && found;
  });
  return entries;
}

function typeMessage(text: string): void {
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: text } });
}

function sendMessage(): void {
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

async function postWithMention(): Promise<void> {
  typeMessage("Please look, @web-post-r");
  fireEvent.click(await screen.findByRole("button", { name: "@web-post-reviewer" }));
  sendMessage();
  await within(screen.getByRole("list", { name: "Messages" })).findByText(/Please look/u);
}

async function openedThenRevoked(name: string, channel: string): Promise<() => void> {
  const poster = await newIdentity({ kind: "human", name });
  await channelWith(channel, "Earlier");
  const close = openAt({ client: poster.client, hash: `#/channels/${channel}` });
  await shownMessages();
  await adminClient().rotateToken(name);
  return close;
}

it("a person posts a top-level message with an @ mention, it appears in the channel, and the mentioned identity's inbox has it", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const poster = await newIdentity({ kind: "human", name: "web-post-poster" });
  const mentioned = await newIdentity({ kind: "agent", name: "web-post-reviewer" });
  await channelWith("web-post", "Earlier");
  const close = openAt({ client: poster.client, hash: "#/channels/web-post", live: watched(poster.client).live });
  await shownMessages();
  await postWithMention();

  expect([
    await shownMessages(),
    screen.getByLabelText<HTMLTextAreaElement>("Message").value,
    await inboxOnceFilled(mentioned.client),
    await inboxOf(poster.client),
  ]).toStrictEqual([
    ["@adminEarlier0 replies", "@web-post-posterPlease look, @web-post-reviewer 0 replies"],
    "",
    [["Please look, @web-post-reviewer ", ["mention"]]],
    [],
  ]);

  close();
});

it("a refused post says so and keeps its text in the box", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = await openedThenRevoked("web-post-rotated", "web-post-refused");
  typeMessage("Too late");
  sendMessage();
  const alert = await alertSaying("Couldn't post the message");

  expect([alert.textContent, await shownMessages(), screen.queryByDisplayValue("Too late")]).toStrictEqual([
    expect.stringMatching(/^Couldn't post the message \(token_revoked\)/u),
    ["@adminEarlier0 replies"],
    screen.getByLabelText("Message"),
  ]);

  close();
});
