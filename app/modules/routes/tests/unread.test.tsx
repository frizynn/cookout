import type { CookoutClient, EventStream, Message, PostMessageRequest } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { inSidebar } from "./regions.ts";
import { openAt } from "./render.tsx";
import { watched } from "./watched.ts";

interface UnreadView {
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
  readonly close: () => Promise<void>;
}

async function closeBoth(unmount: () => void, stream: Promise<EventStream>): Promise<void> {
  unmount();
  const events = await stream;
  await events.close();
}

function countsOn(channel: string): readonly (string | null)[] {
  const link = inSidebar().getByRole("link", { name: new RegExp(`^#${channel}(?![a-z-])`, "u") });
  const counts: (string | null)[] = [];
  for (const count of within(link).queryAllByText(/^\d+ (?:unread|for you)$/u)) {
    counts.push(count.textContent);
  }
  return counts;
}

async function shownCounts(channel: string, counts: readonly string[]): Promise<void> {
  globalThis.location.hash = "#/";
  await waitFor(() => {
    expect(countsOn(channel)).toStrictEqual(counts);
  });
}

async function opened(hash: string, text: string): Promise<void> {
  globalThis.location.hash = hash;
  await screen.findByText(text);
}

async function openList(name: string): Promise<UnreadView> {
  const poster = await newIdentity({ kind: "agent", name: `${name}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${name}-reader` });
  await adminClient().createChannel({ name });
  await reader.client.subscribe(name);
  const { live, stream } = watched(reader.client);
  const unmount = openAt({ client: reader.client, hash: "#/", live });
  await screen.findByRole("navigation", { name: "Sidebar" });
  await inSidebar().findByRole("link", { name: new RegExp(`^#${name}(?![a-z-])`, "u") });
  await stream;
  return {
    close: async () => {
      await closeBoth(unmount, stream);
    },
    poster: poster.client,
    reader: reader.client,
  };
}

async function postAs(client: CookoutClient, channel: string, text: string): Promise<Message> {
  const { message } = await client.createMessage({ channel, text });
  return message;
}

it("the channel list counts what is for you in a channel apart from its other unread messages", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-unread-counts";
  const { close, poster } = await openList(channel);
  await postAs(poster, channel, "Deploy at noon?");
  await postAs(poster, channel, "Or at one?");
  await postAs(poster, channel, "@web-unread-counts-reader can you check?");
  await postAs(poster, channel, "@web-unread-counts-reader and the rollback?");

  await shownCounts(channel, ["2 unread", "2 for you"]);

  await close();
});

it("a channel's unread count rises live as messages arrive, and drops to zero once the channel is opened", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-unread-live";
  const { close, poster } = await openList(channel);
  await postAs(poster, channel, "Deploy at noon?");
  await shownCounts(channel, ["1 unread"]);
  await postAs(poster, channel, "@web-unread-live-reader at noon?");
  await shownCounts(channel, ["1 unread", "1 for you"]);

  await opened(`#/channels/${channel}`, "Deploy at noon?");

  await shownCounts(channel, []);

  await close();
});

it("a reply's unread count drops to zero once its thread is opened, not when its channel is", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-unread-thread";
  const { close, poster, reader } = await openList(channel);
  const parent = await postAs(reader, channel, "Deploy at noon?");
  await poster.createMessage({ channel, replyTo: parent.id, text: "Noon works" });
  await opened(`#/channels/${channel}`, "1 reply");
  await shownCounts(channel, ["1 for you"]);

  await opened(`#/channels/${channel}/threads/${String(parent.id)}`, "Noon works");

  await shownCounts(channel, []);

  await close();
});

async function openedAndRead(hash: string, text: string, channel: string): Promise<void> {
  await opened(hash, text);
  await shownCounts(channel, []);
}

function countOf(request: PostMessageRequest): string {
  if ("replyTo" in request) {
    return "1 for you";
  }
  return "1 unread";
}

async function postedWhileClosed(poster: CookoutClient, request: PostMessageRequest): Promise<void> {
  await poster.createMessage(request);
  await shownCounts(request.channel, [countOf(request)]);
}

function threadOf(parent: Message): string {
  return `#/channels/${parent.channel}/threads/${String(parent.id)}`;
}

it("reopening a channel acks what arrived since it was last open, so its count drops back to zero", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-unread-reopen";
  const { close, poster } = await openList(channel);
  await postAs(poster, channel, "Deploy at noon?");
  await openedAndRead(`#/channels/${channel}`, "Deploy at noon?", channel);
  await postedWhileClosed(poster, { channel, text: "Or at one?" });

  await opened(`#/channels/${channel}`, "Or at one?");

  await shownCounts(channel, []);

  await close();
});

it("reopening a thread acks the replies that arrived since it was last open, so its count drops back to zero", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-unread-reopen-thread";
  const { close, poster, reader } = await openList(channel);
  const parent = await postAs(reader, channel, "Deploy at noon?");
  await poster.createMessage({ channel, replyTo: parent.id, text: "Noon works" });
  await openedAndRead(threadOf(parent), "Noon works", channel);
  await postedWhileClosed(poster, { channel, replyTo: parent.id, text: "One works too" });

  await opened(threadOf(parent), "One works too");

  await shownCounts(channel, []);

  await close();
});
