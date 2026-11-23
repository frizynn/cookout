import type { CookoutClient, InboxResponse, Message } from "../../sdk/index.ts";
import { adminClient, clientWith, newIdentity, openAt } from "./app.tsx";
import { expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";

const NONE = 0;

async function post(channel: string, text: string): Promise<Message> {
  const { message } = await adminClient().createMessage({ channel, text });
  return message;
}

async function replyTo(parent: Message, text: string): Promise<void> {
  await adminClient().createMessage({ channel: parent.channel, replyTo: parent.id, text });
}

async function twoReplies(parent: Message): Promise<void> {
  await replyTo(parent, "First reply");
  await replyTo(parent, "Second reply");
}

async function threadIn(channel: string): Promise<Message> {
  await adminClient().createChannel({ name: channel });
  const parent = await post(channel, "The parent");
  await twoReplies(parent);
  return parent;
}

async function followedThreadIn(channel: string, client: CookoutClient): Promise<Message> {
  await adminClient().createChannel({ name: channel });
  const parent = await post(channel, "The parent");
  await client.follow(parent.id);
  await twoReplies(parent);
  return parent;
}

function sendReply(text: string): void {
  fireEvent.change(screen.getByLabelText("Reply"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
}

function hashOf(parent: Message): string {
  return `#/channels/${parent.channel}/threads/${String(parent.id)}`;
}

async function shownReplies(): Promise<readonly (string | null)[]> {
  const list = await screen.findByRole("list", { name: "Replies" });
  const shown: (string | null)[] = [];
  for (const item of within(list).getAllByRole("listitem")) {
    shown.push(item.textContent);
  }
  return shown;
}

async function inboxOnceEmpty(client: CookoutClient): Promise<InboxResponse | false> {
  const inbox = await client.inbox();
  return inbox.items.length === NONE && inbox;
}

it("the thread view shows the parent message and its replies, oldest first", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const parent = await threadIn("web-thread-shows");
  const close = openAt({ client: adminClient(), hash: hashOf(parent) });

  const replies = await shownReplies();

  expect([screen.getByRole("article", { name: "Parent message" }).textContent, replies]).toStrictEqual([
    "@adminThe parent",
    ["@adminFirst reply", "@adminSecond reply"],
  ]);

  close();
});

it("opening a thread acks its latest message, so the thread leaves the inbox", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const reader = await newIdentity({ kind: "human", name: "web-thread-reader" });
  const parent = await followedThreadIn("web-thread-read", reader.client);
  const before = await reader.client.inbox();
  const close = openAt({ client: reader.client, hash: hashOf(parent) });
  await shownReplies();

  const after = await vi.waitUntil(async () => {
    const inbox = await inboxOnceEmpty(reader.client);
    return inbox;
  });

  expect([before.items.map((item) => item.message.text), after.items]).toStrictEqual([
    ["First reply", "Second reply"],
    [],
  ]);

  close();
});

it("posting a reply shows it in the thread", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const parent = await threadIn("web-thread-reply");
  const close = openAt({ client: adminClient(), hash: hashOf(parent) });
  await shownReplies();

  sendReply("My reply");
  await screen.findByText("My reply");

  const { replies } = await adminClient().getThread(parent.id);

  expect([await shownReplies(), replies.map((reply) => reply.text)]).toStrictEqual([
    ["@adminFirst reply", "@adminSecond reply", "@adminMy reply"],
    ["First reply", "Second reply", "My reply"],
  ]);

  close();
});

it("a thread with no replies says so", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await adminClient().createChannel({ name: "web-thread-empty" });
  const parent = await post("web-thread-empty", "Alone");
  const close = openAt({ client: adminClient(), hash: hashOf(parent) });

  const empty = await screen.findByText("No replies yet.");

  expect([empty.textContent, screen.queryByRole("alert")]).toStrictEqual(["No replies yet.", null]);

  close();
});

it("the thread view links back to its channel", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const parent = await threadIn("web-thread-back");
  const close = openAt({ client: adminClient(), hash: hashOf(parent) });

  const back = await screen.findByRole("link", { name: "← #web-thread-back" });

  expect(back.getAttribute("href")).toBe("#/channels/web-thread-back");

  close();
});

it("a thread that doesn't exist shows the server's refusal", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt({ client: adminClient(), hash: "#/channels/general/threads/999999" });

  const alert = await screen.findByRole("alert");

  expect(alert.textContent).toMatch(/^Couldn't load the thread \(message_not_found\)/u);

  close();
});

it("a refused ack says the thread couldn't be marked read", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const parent = await threadIn("web-thread-ack-refused");
  const agent = await newIdentity({ kind: "agent", name: "web-thread-held" });
  await agent.client.join({ as: "web-thread-held" });
  const close = openAt({ client: clientWith(agent.token), hash: hashOf(parent) });

  const alert = await screen.findByRole("alert");

  expect(alert.textContent).toMatch(/^Couldn't mark the thread read \(lease_required\)/u);

  close();
});

it("a refused reply says so and keeps the thread shown", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const parent = await threadIn("web-thread-reply-refused");
  const writer = await newIdentity({ kind: "human", name: "web-thread-rotated" });
  const close = openAt({ client: writer.client, hash: hashOf(parent) });
  await shownReplies();
  await adminClient().rotateToken("web-thread-rotated");

  sendReply("Too late");
  const alert = await screen.findByRole("alert");

  expect([alert.textContent, await shownReplies()]).toStrictEqual([
    expect.stringMatching(/^Couldn't post the reply \(token_revoked\)/u),
    ["@adminFirst reply", "@adminSecond reply"],
  ]);

  close();
});
