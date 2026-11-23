import type { CookoutClient, EventStream, Message } from "../../sdk/index.ts";
import { expect, it } from "vitest";
import { inPane, inSidebar } from "./regions.ts";
import { rowsOf, subscribedReader } from "./inbox-reader.ts";
import { screen, within } from "@testing-library/react";
import { openWithClockStopped } from "./clock.ts";
import { watched } from "./watched.ts";

const CAUGHT_UP = "You're all caught up.";

interface Thread {
  readonly channel: string;
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
  readonly parent: Message;
}

async function threadWithNews(channel: string): Promise<Thread> {
  const { poster, reader } = await subscribedReader(channel);
  const { message: parent } = await poster.createMessage({ channel, text: "Deploy at noon?" });
  await reader.follow(parent.id);
  await reader.ack(parent.id);
  await poster.createMessage({ channel, replyTo: parent.id, text: `@${channel}-reader look` });
  await poster.createMessage({ channel, replyTo: parent.id, text: "Two" });
  return { channel, parent, poster, reader };
}

async function openInbox(reader: CookoutClient): Promise<() => Promise<void>> {
  const { live, stream } = watched(reader);
  const unmount = openWithClockStopped({ client: reader, hash: "#/inbox", live });
  await screen.findByRole("list", { name: "Earlier" });
  const events: EventStream = await stream;
  return async () => {
    unmount();
    await events.close();
  };
}

function inboxBadges(): readonly string[] {
  const link = inSidebar().getByRole("link", { name: /^Inbox/u });
  const badges: string[] = [];
  for (const label of within(link).queryAllByText(/^\d+ (?:unread|for you)$/u)) {
    badges.push(label.textContent);
  }
  return badges;
}

function threadRow({ channel, parent }: Thread, row: string): string {
  return `#/channels/${channel}/threads/${String(parent.id)} Mentioned you${channel}-posterreplied in a thread in#${channel}${row}`;
}

async function shown(): Promise<readonly unknown[]> {
  await screen.findByRole("heading", { level: 2, name: "For you 1" });
  return [rowsOf("For you"), inboxBadges()];
}

interface News {
  readonly count: number;
  readonly last: string;
}

const MENTIONS = 1;

function shownWith(thread: Thread, { count, last }: News): readonly unknown[] {
  return [
    [threadRow(thread, `${String(count)} newjust nowre: Deploy at noon?${last}`)],
    [`${String(count - MENTIONS)} unread`, "1 for you"],
  ];
}

const TWO_NEW: News = { count: 2, last: "Two" };

async function leftOut(): Promise<readonly unknown[]> {
  await inPane().findByText(CAUGHT_UP);
  return [
    screen.queryByRole("list", { name: "For you" }),
    screen.queryByRole("list", { name: "Activity" }),
    inboxBadges(),
  ];
}

const LEFT_OUT = [null, null, []];

it("closing a thread elsewhere takes its unread items out of the Inbox and the sidebar's count, live", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const thread = await threadWithNews("web-closed-live");
  const close = await openInbox(thread.reader);

  await expect(shown()).resolves.toStrictEqual(shownWith(thread, TWO_NEW));

  await thread.poster.closeThread(thread.parent.id);

  await expect(leftOut()).resolves.toStrictEqual(LEFT_OUT);

  await close();
});

it("reopening a closed thread brings its items back to the Inbox, still unread", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const thread = await threadWithNews("web-closed-reopen");
  await thread.poster.closeThread(thread.parent.id);
  const close = await openInbox(thread.reader);
  await inPane().findByText(CAUGHT_UP);

  await thread.poster.reopenThread(thread.parent.id);

  await expect(shown()).resolves.toStrictEqual(shownWith(thread, TWO_NEW));

  await close();
});

it("an Inbox loaded with a thread already closed leaves its items out, though the reader's inbox still lists them", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const thread = await threadWithNews("web-closed-load");
  await thread.poster.closeThread(thread.parent.id);
  const close = await openInbox(thread.reader);
  const left = await leftOut();
  const { items } = await thread.reader.inbox();

  expect([left, items.map((item) => item.message.text)]).toStrictEqual([
    LEFT_OUT,
    [`@${thread.channel}-reader look`, "Two"],
  ]);

  await close();
});

it("a reply in a closed thread reopens it, and the Inbox shows the reply with the earlier unread items", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const thread = await threadWithNews("web-closed-reply");
  await thread.poster.closeThread(thread.parent.id);
  const close = await openInbox(thread.reader);
  await inPane().findByText(CAUGHT_UP);

  await thread.poster.createMessage({ channel: thread.channel, replyTo: thread.parent.id, text: "Three" });
  await screen.findByText("3 new");

  await expect(shown()).resolves.toStrictEqual(shownWith(thread, { count: 3, last: "Three" }));

  await close();
});
