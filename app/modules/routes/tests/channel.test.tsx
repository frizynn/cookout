import type { CookoutClient, InboxResponse, Message } from "../../sdk/index.ts";
import { adminClient, clientWith, newIdentity, openAt } from "./app.tsx";
import { expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";

const ONE_A_PAGE = 1;
const TWO_A_PAGE = 2;
const NONE = 0;
const FIRST = 0;
const REST = 1;

async function post(channel: string, text: string): Promise<Message> {
  const { message } = await adminClient().createMessage({ channel, text });
  return message;
}

async function postInOrder(channel: string, texts: readonly string[]): Promise<void> {
  if (texts.length === NONE) {
    return;
  }
  await Promise.all(
    texts.slice(FIRST, REST).map(async (text) => {
      await post(channel, text);
    }),
  );
  await postInOrder(channel, texts.slice(REST));
}

async function channelWith(name: string, texts: readonly string[]): Promise<void> {
  await adminClient().createChannel({ name });
  await postInOrder(name, texts);
}

async function threadWithReplies(channel: string, replies: number): Promise<Message> {
  const parent = await post(channel, "First");
  await Promise.all(
    Array.from({ length: replies }, async () => {
      await adminClient().createMessage({ channel, replyTo: parent.id, text: "A reply" });
    }),
  );
  return parent;
}

async function subscribedTo(channel: string, client: CookoutClient): Promise<void> {
  await adminClient().createChannel({ name: channel });
  await client.subscribe(channel);
}

async function shownMessages(): Promise<readonly (string | null)[]> {
  const list = await screen.findByRole("list", { name: "Messages" });
  const shown: (string | null)[] = [];
  for (const link of within(list).getAllByRole("link")) {
    shown.push(link.textContent);
  }
  return shown;
}

async function inboxOnceEmpty(client: CookoutClient): Promise<InboxResponse | false> {
  const inbox = await client.inbox();
  return inbox.items.length === NONE && inbox;
}

it("the channel view shows the channel's top-level messages, oldest first, with their reply counts", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  await adminClient().createChannel({ name: "web-channel-shows" });
  const parent = await threadWithReplies("web-channel-shows", TWO_A_PAGE);
  await postInOrder("web-channel-shows", ["Second", "Third"]);
  const close = openAt({ client: adminClient(), hash: "#/channels/web-channel-shows" });

  const shown = await shownMessages();

  expect([shown, screen.getByRole("link", { name: /First/u }).getAttribute("href")]).toStrictEqual([
    ["@adminFirst2 replies", "@adminSecond0 replies", "@adminThird0 replies"],
    `#/channels/web-channel-shows/threads/${String(parent.id)}`,
  ]);

  close();
});

it("a message with one reply says 1 reply", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await adminClient().createChannel({ name: "web-channel-one-reply" });
  await threadWithReplies("web-channel-one-reply", ONE_A_PAGE);
  const close = openAt({ client: adminClient(), hash: "#/channels/web-channel-one-reply" });

  await expect(shownMessages()).resolves.toStrictEqual(["@adminFirst1 reply"]);

  close();
});

it('"Load more" loads the older messages, until there are none', { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWith("web-channel-pages", ["One", "Two", "Three"]);
  const close = openAt({ client: adminClient(), hash: "#/channels/web-channel-pages", pageSize: TWO_A_PAGE });
  const firstPage = await shownMessages();

  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  await screen.findByRole("link", { name: /One/u });

  expect([firstPage, await shownMessages(), screen.queryByRole("button", { name: "Load more" })]).toStrictEqual([
    ["@adminTwo0 replies", "@adminThree0 replies"],
    ["@adminOne0 replies", "@adminTwo0 replies", "@adminThree0 replies"],
    null,
  ]);

  close();
});

it('clicking "Load more" twice before it answers loads the older page once', { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWith("web-channel-double-click", ["One", "Two", "Three"]);
  const close = openAt({ client: adminClient(), hash: "#/channels/web-channel-double-click", pageSize: TWO_A_PAGE });
  await shownMessages();

  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  await screen.findByRole("link", { name: /One/u });

  await expect(shownMessages()).resolves.toStrictEqual([
    "@adminOne0 replies",
    "@adminTwo0 replies",
    "@adminThree0 replies",
  ]);

  close();
});

it("viewing a channel acks its newest top-level message, so its messages leave the inbox", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const reader = await newIdentity({ kind: "human", name: "web-channel-reader" });
  await subscribedTo("web-channel-read", reader.client);
  await postInOrder("web-channel-read", ["Older", "Newest"]);
  const before = await reader.client.inbox();
  const close = openAt({ client: reader.client, hash: "#/channels/web-channel-read" });
  await shownMessages();

  const after = await vi.waitUntil(async () => {
    const inbox = await inboxOnceEmpty(reader.client);
    return inbox;
  });

  expect([before.items.map((item) => item.message.text), after.items]).toStrictEqual([["Older", "Newest"], []]);

  close();
});

it("an empty channel says it has no messages", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWith("web-channel-empty", []);
  const close = openAt({ client: adminClient(), hash: "#/channels/web-channel-empty" });

  const empty = await screen.findByText("No messages yet.");

  expect([empty.textContent, screen.queryByRole("alert")]).toStrictEqual(["No messages yet.", null]);

  close();
});

it("a channel that doesn't exist shows Nothing here", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt({ client: adminClient(), hash: "#/channels/web-channel-missing" });

  const heading = await screen.findByRole("heading", { level: 1, name: "Nothing here" });

  expect([heading.textContent, screen.queryByRole("alert")]).toStrictEqual(["Nothing here", null]);

  close();
});

it("a deleted channel shows Nothing here", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWith("web-channel-deleted", ["Soon gone"]);
  await adminClient().deleteChannel("web-channel-deleted");
  const close = openAt({ client: adminClient(), hash: "#/channels/web-channel-deleted" });

  const heading = await screen.findByRole("heading", { level: 1, name: "Nothing here" });

  expect(heading.textContent).toBe("Nothing here");

  close();
});

it("a refused ack says the channel couldn't be marked read", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWith("web-channel-ack-refused", ["Hello"]);
  const agent = await newIdentity({ kind: "agent", name: "web-channel-held" });
  await agent.client.join({ as: "web-channel-held" });
  const close = openAt({ client: clientWith(agent.token), hash: "#/channels/web-channel-ack-refused" });

  const alert = await screen.findByRole("alert");

  expect(alert.textContent).toMatch(/^Couldn't mark the channel read \(lease_required\)/u);

  close();
});

it("a refused older page says so and keeps the messages shown", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWith("web-channel-older-refused", ["A", "B"]);
  const reader = await newIdentity({ kind: "human", name: "web-channel-rotated" });
  const close = openAt({ client: reader.client, hash: "#/channels/web-channel-older-refused", pageSize: ONE_A_PAGE });
  await shownMessages();
  await reader.rotateToken();

  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  const alert = await screen.findByRole("alert");

  expect([alert.textContent, await shownMessages()]).toStrictEqual([
    expect.stringMatching(/^Couldn't load older messages \(token_revoked\)/u),
    ["@adminB0 replies"],
  ]);

  close();
});
