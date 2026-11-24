import type { BoardStore, ChannelMessagesState, ThreadMessagesState } from "../index.ts";
import type {
  ChannelName,
  CookoutClient,
  IdentityName,
  Message,
  MessageId,
  Reply,
  TopLevelMessage,
} from "../../sdk/index.ts";
import { channelPage, createBoardStore, threadOf } from "../index.ts";
import { expect, it, onTestFinished, vi } from "vitest";
import type { HandLive } from "../../testing/web.ts";
import { createCookoutClient } from "../../sdk/index.ts";
import { createLive } from "../../live/index.ts";
import { handLive } from "../../testing/web.ts";
import { webTestCookout } from "../../../../scripts/web-test-server.ts";

interface Opened {
  readonly store: BoardStore;
  readonly hand: HandLive;
}

interface Human {
  readonly name: IdentityName;
  readonly client: CookoutClient;
}

type Loaded<State> = Extract<State, { readonly status: "loaded" }>;

type ChannelLoaded = Loaded<ChannelMessagesState>;

type ThreadLoaded = Loaded<ThreadMessagesState>;

function adminClient(): CookoutClient {
  return createCookoutClient({ env: {}, token: webTestCookout().adminToken, url: webTestCookout().url });
}

async function humanIn(channel: string): Promise<Human> {
  const { identity, token } = await adminClient().createIdentity({ kind: "human", name: `${channel}-bob` });
  return { client: createCookoutClient({ env: {}, token, url: webTestCookout().url }), name: identity.name };
}

async function postedIn(channel: string): Promise<TopLevelMessage> {
  await adminClient().createChannel({ name: channel });
  const { message } = await adminClient().createMessage({ channel, text: "Ship it?" });
  if (message.kind !== "top-level") {
    throw new Error("A message posted without replyTo is top-level.");
  }
  return message;
}

async function repliedTo(parent: TopLevelMessage, client: CookoutClient = adminClient()): Promise<Reply> {
  const { message } = await client.createMessage({ channel: parent.channel, replyTo: parent.id, text: "Shipped." });
  if (message.kind !== "reply") {
    throw new Error("A message posted with replyTo is a reply.");
  }
  return message;
}

const PAGE_SIZE = 50;

const SMALL_PAGE = 2;

const ONE_REPLY = 1;

const LAST = -1;

function opened(client: CookoutClient = adminClient(), pageSize = PAGE_SIZE): Opened {
  const hand = handLive();
  const store = createBoardStore({ client, live: createLive(hand.adapter), pageSize });
  return { hand, store };
}

function shown(unsubscribe: () => void): void {
  onTestFinished(unsubscribe);
}

async function channelShown(store: BoardStore, channel: ChannelName): Promise<() => ChannelLoaded> {
  const select = channelPage(channel);
  shown(store.channelPages.subscribeShowing(channel)(vi.fn<() => void>()));
  function read(): ChannelLoaded {
    const state = select(store.snapshot());
    if (state.status !== "loaded") {
      throw new Error(`The channel is ${state.status}.`);
    }
    return state;
  }
  await vi.waitFor(read);
  return read;
}

async function threadShown(store: BoardStore, parent: Message): Promise<() => ThreadLoaded> {
  const place = { channel: parent.channel, id: parent.id };
  const select = threadOf(place);
  shown(store.threads.subscribeShowing(place, true)(vi.fn<() => void>()));
  function read(): ThreadLoaded {
    const state = select(store.snapshot());
    if (state.status !== "loaded") {
      throw new Error(`The thread is ${state.status}.`);
    }
    return state;
  }
  await vi.waitFor(read);
  return read;
}

interface Both extends Opened {
  readonly page: () => ChannelLoaded;
  readonly thread: () => ThreadLoaded;
}

async function bothShown(parent: TopLevelMessage, pageSize = PAGE_SIZE): Promise<Both> {
  const { hand, store } = opened(adminClient(), pageSize);
  const [page, thread] = await Promise.all([channelShown(store, parent.channel), threadShown(store, parent)]);
  return { hand, page, store, thread };
}

async function postedBy(client: CookoutClient, parent: TopLevelMessage): Promise<readonly MessageId[]> {
  const posted = await Promise.all(
    ["One", "Two", "Three"].map(async (text) => {
      const { message } = await client.createMessage({ channel: parent.channel, text });
      return message.id;
    }),
  );
  return posted.toSorted((first, second) => first - second);
}

function newestOf(ids: readonly MessageId[]): MessageId | null {
  return ids.at(LAST) ?? null;
}

interface CountedReads {
  readonly client: CookoutClient;
  readonly reads: readonly string[];
}

function countingReads(): CountedReads {
  const admin = adminClient();
  const reads: string[] = [];
  return {
    client: {
      ...admin,
      listMessages: async (channel, query) => {
        reads.push(channel);
        const answer = await admin.listMessages(channel, query);
        return answer;
      },
    },
    reads,
  };
}

function ackedAt({ read }: ChannelLoaded | ThreadLoaded): MessageId | null {
  if (read.status !== "acked") {
    return null;
  }
  return read.readPosition.messageId;
}

function bounce(hand: HandLive): void {
  hand.report("down");
  hand.report("up");
}

function idsOf(messages: readonly Message[]): readonly number[] {
  return messages.map((message) => message.id);
}

it("a message event shows in its channel page and its thread once, and the same event again changes nothing", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const parent = await postedIn("store-messages-event");
  const { hand, page, thread } = await bothShown(parent);
  const reply = await repliedTo(parent);
  hand.send({ message: reply, type: "message" });
  const [pageAfter, threadAfter] = [page(), thread()];
  hand.send({ message: reply, type: "message" });

  expect([pageAfter.messages.map((message) => message.replyCount), idsOf(threadAfter.replies)]).toStrictEqual([
    [ONE_REPLY],
    [reply.id],
  ]);
  expect(page()).toBe(pageAfter);
  expect(thread()).toBe(threadAfter);
});

it("a thread event closes the thread in its channel page and its thread panel at once", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const parent = await postedIn("store-messages-closed");
  const { hand, page, thread } = await bothShown(parent);
  const { message: closed } = await adminClient().closeThread(parent.id);
  hand.send({ parent: closed, type: "thread" });

  expect([page().messages.map((message) => message.closedAt), thread().parent.closedAt]).toStrictEqual([
    [closed.closedAt],
    closed.closedAt,
  ]);
});

it("a message posted through the store shows once, though the stream also sends it", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const parent = await postedIn("store-messages-posted");
  const { hand, store } = opened();
  const page = await channelShown(store, parent.channel);
  const posted = vi.fn<() => void>();
  store.channelPages.post(parent.channel, { posted, text: "Mine." });
  await vi.waitFor(() => {
    expect(posted).toHaveBeenCalledTimes(ONE_REPLY);
  });
  for (const message of page().messages) {
    hand.send({ message, type: "message" });
  }

  expect(page().messages.map((message) => message.text)).toStrictEqual(["Ship it?", "Mine."]);
});

it("a thread event heard while the channel page is read wins over what the read brings", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const parent = await postedIn("store-messages-read");
  const hand = handLive();
  const admin = adminClient();
  const store = createBoardStore({
    client: {
      ...admin,
      listMessages: async (channel, query) => {
        const answer = await admin.listMessages(channel, query);
        const { message } = await admin.closeThread(parent.id);
        hand.send({ parent: message, type: "thread" });
        return answer;
      },
    },
    live: createLive(hand.adapter),
  });
  const page = await channelShown(store, parent.channel);

  expect(page().messages.map((message) => typeof message.closedAt)).toStrictEqual(["string"]);
});

it("link down then up reads each open channel again, paging back to what it shows, and its thread, acking the newest", {
  timeout: 10_000,
}, async () => {
  expect.hasAssertions();

  const parent = await postedIn("store-messages-gap");
  const bob = await humanIn("store-messages-gap");
  const { hand, page, thread } = await bothShown(parent, SMALL_PAGE);
  hand.report("down");
  const missed = await postedBy(bob.client, parent);
  const reply = await repliedTo(parent, bob.client);
  hand.report("up");

  await vi.waitFor(() => {
    expect([idsOf(page().messages), ackedAt(page()), idsOf(thread().replies), ackedAt(thread())]).toStrictEqual([
      [parent.id, ...missed],
      newestOf(missed),
      [reply.id],
      reply.id,
    ]);
  });
});

it("a channel page nobody shows isn't read again on a link back", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const parent = await postedIn("store-messages-hidden");
  const { client, reads } = countingReads();
  const { hand, store } = opened(client);
  const unsubscribe = store.channelPages.subscribeShowing(parent.channel)(vi.fn<() => void>());
  await vi.waitFor(() => {
    expect(channelPage(parent.channel)(store.snapshot()).status).toBe("loaded");
  });
  unsubscribe();
  bounce(hand);

  expect(reads).toStrictEqual([parent.channel]);
});
