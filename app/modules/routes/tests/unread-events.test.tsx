import type { CookoutClient, InboxItem, Message, ReadPosition, ServerSentEvent } from "../../sdk/index.ts";
import { adminClient, newIdentity, openAt } from "./app.tsx";
import { expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Live } from "../../live/index.ts";
import { createLive } from "../../live/index.ts";

interface Scripted {
  readonly live: Live;
  readonly send: (...events: readonly ServerSentEvent[]) => void;
}

interface Inbox {
  readonly first: Message;
  readonly second: Message;
  readonly reader: CookoutClient;
  readonly items: readonly InboxItem[];
}

function scripted(): Scripted {
  const opened: ((event: ServerSentEvent) => void)[] = [];
  const live = createLive({
    open: (onEvent) => {
      opened.push(onEvent);
    },
  });
  return {
    live,
    send: (...events) => {
      for (const onEvent of opened) {
        for (const event of events) {
          onEvent(event);
        }
      }
    },
  };
}

function itemSent(item: InboxItem): ServerSentEvent {
  return { data: JSON.stringify({ item, type: "inbox-item" }), event: "inbox-item" };
}

function readUpTo(message: Message): ServerSentEvent {
  const readPosition: ReadPosition = { channel: message.channel, messageId: message.id, thread: null };
  return { data: JSON.stringify({ readPosition, type: "read-position" }), event: "read-position" };
}

function countsOn(channel: string): readonly (string | null)[] {
  const link = screen.getByRole("link", { name: new RegExp(`^#${channel}(?![a-z-])`, "u") });
  const counts: (string | null)[] = [];
  for (const count of within(link).queryAllByText(/^\d+ (?:unread|mentions?)$/u)) {
    counts.push(count.textContent);
  }
  return counts;
}

async function postTo(channel: string, text: string): Promise<Message> {
  const { message } = await adminClient().createMessage({ channel, text });
  return message;
}

async function inboxOf(channel: string): Promise<Inbox> {
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await adminClient().createChannel({ name: channel });
  await reader.client.subscribe(channel);
  const first = await postTo(channel, "First");
  const second = await postTo(channel, "Second");
  await postTo(channel, "Third");
  const { items } = await reader.client.inbox();
  return { first, items, reader: reader.client, second };
}

it("the channel list counts the inbox it loads, and an older read position or a repeated item brings nothing back", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-unread-script";
  const { first, items, reader, second } = await inboxOf(channel);
  const { live, send } = scripted();
  const close = openAt({ client: reader, hash: "#/", live });
  await waitFor(() => {
    expect(countsOn(channel)).toStrictEqual(["3 unread"]);
  });

  send(readUpTo(second), readUpTo(first), ...items.map((item) => itemSent(item)));

  await waitFor(() => {
    expect(countsOn(channel)).toStrictEqual(["1 unread"]);
  });

  close();
});
