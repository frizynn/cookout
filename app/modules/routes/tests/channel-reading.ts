import type { CookoutClient, EventStream } from "../../sdk/index.ts";
import type { HandReading } from "./hand-reading.ts";
import { clockStopped } from "./clock.ts";
import { expect } from "vitest";
import { handReading } from "./hand-reading.ts";
import { inConversation } from "./regions.ts";
import { openAt } from "./render.tsx";
import { subscribedReader } from "./inbox-reader.ts";
import { waitFor } from "@testing-library/react";
import { watched } from "./watched.ts";

const NONE = 0;

interface ReadChannel {
  readonly channel: string;
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
}

async function channelToRead(channel: string): Promise<ReadChannel> {
  const { poster, reader } = await subscribedReader(channel);
  const { message: old } = await poster.createMessage({ channel, text: "Old post" });
  await reader.ack(old.id);
  await poster.createMessage({ channel, text: "New one" });
  await poster.createMessage({ channel, text: "New two" });
  return { channel, poster, reader };
}

async function unreadIn({ channel, reader }: ReadChannel): Promise<number> {
  const inbox = await reader.inbox();
  return inbox.items.filter((item) => item.channel.name === channel && item.message.kind === "top-level").length;
}

interface Counting {
  readonly news: ReadChannel;
  readonly count: number;
}

async function channelUnreadAtLast({ count, news }: Counting): Promise<number> {
  await waitFor(async () => {
    await expect(unreadIn(news)).resolves.toBe(count);
  });
  return count;
}

async function noteShown(): Promise<string> {
  const note = await inConversation().findByText("Marked as read");
  return note.textContent;
}

interface OpenedChannel extends Omit<HandReading, "reading"> {
  readonly close: () => Promise<void>;
  readonly unreadAfter: (millis: number) => Promise<number>;
  readonly readAfter: (millis: number) => Promise<number>;
}

async function openChannelReading(news: ReadChannel): Promise<OpenedChannel> {
  const { advance, page, reading } = handReading();
  const { live, stream } = watched(news.reader);
  clockStopped();
  const unmount = openAt({ client: news.reader, hash: `#/inbox/${news.channel}`, live, reading });
  const events: EventStream = await stream;
  await inConversation().findByText("New two");
  return {
    advance,
    close: async () => {
      unmount();
      await events.close();
    },
    page,
    readAfter: async (millis) => {
      advance(millis);
      const count = await channelUnreadAtLast({ count: NONE, news });
      return count;
    },
    unreadAfter: async (millis) => {
      advance(millis);
      const count = await unreadIn(news);
      return count;
    },
  };
}

export { type ReadChannel, channelToRead, channelUnreadAtLast, noteShown, openChannelReading };
