import type { CookoutClient, EventStream, Message } from "../../sdk/index.ts";
import { adminClient, anonymousClient, newIdentity, openAt, sessionOf } from "./app.tsx";
import { expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { watched } from "./watched.ts";

interface InboxReader {
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
}

interface Posted {
  readonly reader: CookoutClient;
  readonly first: Message;
  readonly parent: Message;
  readonly reply: Message;
  readonly other: Message;
}

interface OpenInbox {
  readonly message: Message;
  readonly reader: CookoutClient;
  readonly close: () => Promise<void>;
}

async function subscribe(reader: CookoutClient, channel: string): Promise<void> {
  await adminClient().createChannel({ name: channel });
  await reader.subscribe(channel);
}

async function subscribedReader(channel: string, ...others: readonly string[]): Promise<InboxReader> {
  const poster = await newIdentity({ kind: "agent", name: `${channel}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await Promise.all(
    [channel, ...others].map(async (name) => {
      await subscribe(reader.client, name);
    }),
  );
  return { poster: poster.client, reader: reader.client };
}

async function postedIn(channel: string, also: string): Promise<Posted> {
  const { poster, reader } = await subscribedReader(channel, also);
  const { message: first } = await poster.createMessage({ channel: also, text: "Lunch?" });
  const { message: parent } = await reader.createMessage({ channel, text: "Deploy at noon?" });
  const { message: reply } = await poster.createMessage({
    channel,
    replyTo: parent.id,
    text: `@${channel}-reader noon`,
  });
  const { message: other } = await poster.createMessage({ channel, text: "Or at one?" });
  return { first, other, parent, reader, reply };
}

async function openWatched(channel: string): Promise<OpenInbox> {
  const { poster, reader } = await subscribedReader(channel);
  const { message } = await poster.createMessage({ channel, text: "Deploy at noon?" });
  const { live, stream } = watched(reader);
  const unmount = openAt({ client: reader, hash: "#/inbox", live });
  await screen.findByRole("list", { name: "Inbox" });
  await stream;
  return {
    close: async () => {
      unmount();
      const events: EventStream = await stream;
      await events.close();
    },
    message,
    reader,
  };
}

function rowsOf(label: string): readonly (string | null)[] {
  const rows: (string | null)[] = [];
  for (const link of within(screen.getByRole("list", { name: label })).getAllByRole("link")) {
    rows.push(`${link.getAttribute("href") ?? ""} ${link.textContent}`);
  }
  return rows;
}

it("the inbox lists each item with its reasons and where it is read, after each channel's unread counts", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-inbox";
  const also = `${channel}-also`;
  const { first, other, parent, reader, reply } = await postedIn(channel, also);
  const unmount = openAt({ client: reader, hash: "#/inbox" });

  await screen.findByRole("list", { name: "Inbox" });

  expect(rowsOf("Unread by channel")).toStrictEqual([
    `#/channels/${channel} #${channel}11 unread@11 mention`,
    `#/channels/${also} #${also}11 unread`,
  ]);
  expect(rowsOf("Inbox")).toStrictEqual([
    `#/channels/${also} #${also}Subscribed channel@${channel}-poster${first.text}`,
    `#/channels/${channel}/threads/${String(parent.id)} #${channel}Followed thread, Mention@${channel}-poster${reply.text}`,
    `#/channels/${channel} #${channel}Subscribed channel@${channel}-poster${other.text}`,
  ]);

  unmount();
});

it("an ack from another session takes its items out of the open inbox, which then says nothing is unread", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { close, message, reader } = await openWatched("web-inbox-ack");

  await reader.ack(message.id);

  await waitFor(() => {
    expect(screen.getByText("Nothing unread.")).toBeDefined();
  });

  expect(screen.queryByRole("list", { name: "Unread by channel" })).toBeNull();

  await close();
});

it("an inbox that can't be read says why", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const unmount = openAt({ client: anonymousClient(), hash: "#/inbox", session: sessionOf(adminClient()) });

  await screen.findByRole("navigation", { name: "Sidebar" });
  const alert = await within(screen.getByRole("main")).findByRole("alert");

  expect(alert.textContent).toMatch(/^Couldn't load the inbox \(\w+\): /u);

  unmount();
});
