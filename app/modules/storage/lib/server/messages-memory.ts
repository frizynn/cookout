import type {
  AppendMessageResult,
  ChannelPageRequest,
  Mentioning,
  MessagesSection,
  NewMessage,
  Placement,
} from "./messages.ts";
import { Array as Arr, Effect, Option, Predicate, Ref, pipe } from "effect";
import { EMPTY_INBOX, afterAppend, memoryInbox } from "./inbox-memory.ts";
import type {
  ListMessagesResponse,
  Message,
  MessageId,
  Reply,
  ThreadResponse,
  TopLevelMessage,
} from "../../../messages/index.ts";
import { asMessageId, counted, isPlaced, placeIn, placed, threadIdOf, withKnownMentions } from "./messages.ts";
import type { ChannelName } from "../../../channels/index.ts";
import type { ChannelsSection } from "./channels.ts";
import type { IdentitiesSection } from "./identities.ts";
import type { InboxSection } from "./inbox.ts";
import type { MemoryInbox } from "./inbox-memory.ts";
import type { MemoryState } from "./memory-state.ts";
import type { StorageUnavailable } from "./errors.ts";
import { isMessageId } from "../../../messages/index.ts";

interface MemoryMessages {
  readonly last: number;
  readonly messages: readonly Message[];
  readonly inbox: MemoryInbox;
}

interface MemoryMessagesOptions {
  readonly channels: ChannelsSection;
  readonly identities: IdentitiesSection;
  readonly state: MemoryState;
}

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

const NEXT = 1;
const EMPTY: MemoryMessages = { inbox: EMPTY_INBOX, last: 0, messages: [] };
const CHANNEL_NOT_FOUND = { status: "channel_not_found" } as const;

function findMessage(messages: readonly Message[], id: MessageId): Option.Option<Message> {
  return Arr.findFirst(messages, (message) => message.id === id);
}

function repliesTo(messages: readonly Message[], parent: MessageId): readonly Reply[] {
  return Arr.filter(messages, (message): message is Reply => message.kind === "reply" && message.replyTo === parent);
}

function current(messages: readonly Message[], parent: TopLevelMessage): TopLevelMessage {
  return counted({ parent, replies: repliesTo(messages, parent.id) });
}

function placementOf(messages: readonly Message[], { channel, replyTo }: NewMessage): Placement {
  if (Predicate.isUndefined(replyTo)) {
    return { status: "top-level" };
  }
  return placeIn({ channel, found: Option.getOrUndefined(findMessage(messages, replyTo)) });
}

function append(data: MemoryMessages, appending: Mentioning): readonly [AppendMessageResult, MemoryMessages] {
  const placement = placementOf(data.messages, appending.message);
  if (!isPlaced(placement)) {
    return [placement, data];
  }
  const last = data.last + NEXT;
  const message = withKnownMentions(appending);
  const stored = placed({ id: asMessageId(last), message, placement });
  return [
    { message: stored, status: "appended" },
    { inbox: afterAppend({ inbox: data.inbox, message: stored }), last, messages: [...data.messages, stored] },
  ];
}

function threadIn(messages: readonly Message[], id: MessageId): ThreadResponse | undefined {
  return pipe(
    findMessage(messages, id),
    Option.flatMap((found) =>
      Arr.findFirst(
        messages,
        (message): message is TopLevelMessage => message.kind === "top-level" && message.id === threadIdOf(found),
      ),
    ),
    Option.map((parent) => ({ parent: current(messages, parent), replies: repliesTo(messages, parent.id) })),
    Option.getOrUndefined,
  );
}

function pageIn(messages: readonly Message[], channel: ChannelName, page: ChannelPageRequest): ListMessagesResponse {
  const { before = Number.MAX_SAFE_INTEGER, limit } = page;
  const older = Arr.filter(
    messages,
    (message): message is TopLevelMessage =>
      message.kind === "top-level" && message.channel === channel && message.id < before,
  );
  const shown = Arr.takeRight(older, limit);
  return { hasMore: older.length > shown.length, messages: Arr.map(shown, (parent) => current(messages, parent)) };
}

function memoryMessages({ channels, identities, state }: MemoryMessagesOptions): MessagesSection & InboxSection {
  const ref = Ref.makeUnsafe(EMPTY);
  function change<Value>(work: (data: MemoryMessages) => readonly [Value, MemoryMessages]): Fails<Value> {
    return Effect.andThen(state.ensureOpen, Ref.modify(ref, work));
  }
  function readBoard<Value>(work: (data: MemoryMessages) => Value): Fails<Value> {
    return Effect.andThen(state.ensureOpen, Effect.map(Ref.get(ref), work));
  }
  function read<Value>(work: (messages: readonly Message[]) => Value): Fails<Value> {
    return readBoard((data) => work(data.messages));
  }
  function channelExists(channel: ChannelName): Fails<boolean> {
    return Effect.map(channels.findChannel(channel), Predicate.isNotUndefined);
  }
  const knownNames: Fails<Mentioning["known"]> = Effect.map(
    identities.listIdentities(),
    (listed) => new Set(Arr.map(listed, (identity) => identity.name)),
  );
  return {
    ...memoryInbox({
      changeInbox: (work) =>
        change((data) => {
          const [value, inbox] = work(data);
          return [value, { ...data, inbox }];
        }),
      channelExists,
      read: readBoard,
    }),
    appendMessage: (message) =>
      Effect.flatMap(channelExists(message.channel), (exists): Fails<AppendMessageResult> => {
        if (exists) {
          return Effect.flatMap(knownNames, (known) => change((data) => append(data, { known, message })));
        }
        return Effect.succeed(CHANNEL_NOT_FOUND);
      }),
    getThread: (id) => read((messages) => threadIn(messages, id)),
    latestMessageId: () => readBoard(({ last }) => Option.getOrUndefined(Option.liftPredicate(last, isMessageId))),
    listChannelMessages: (channel, page) =>
      Effect.flatMap(channelExists(channel), (exists) => {
        if (exists) {
          return read((messages) => pageIn(messages, channel, page));
        }
        return Effect.undefined;
      }),
  };
}

export { memoryMessages };
