import type {
  AppendMessageResult,
  ChannelPageRequest,
  Mentioning,
  MessagesSection,
  NewMessage,
  Placement,
  StoredPage,
  StoredThread,
  ThreadStateChange,
} from "./messages.ts";
import { Array as Arr, Effect, Option, Predicate, Ref, pipe } from "effect";
import type { Author, Closing, Message, MessageId, Reply, TopLevelMessage } from "../../../messages/index.ts";
import { EMPTY_INBOX, withoutChannel, withoutIdentity } from "./inbox-memory-state.ts";
import { afterAppend, memoryInbox } from "./inbox-memory.ts";
import { asMessageId, counted, isPlaced, placeIn, placed, threadIdOf, withKnownMentions } from "./messages.ts";
import { isMessageId, reopened } from "../../../messages/index.ts";
import type { ChannelName } from "../../../channels/index.ts";
import type { IdentitiesSection } from "./identities.ts";
import type { MemoryChannelsSection } from "./channels.ts";
import type { MemoryInbox } from "./inbox-memory-state.ts";
import type { MemoryInboxSection } from "./inbox-memory.ts";
import type { MemoryState } from "./memory-state.ts";
import type { StorageUnavailable } from "./errors.ts";

interface MemoryMessages {
  readonly last: number;
  readonly messages: readonly Message[];
  readonly inbox: MemoryInbox;
}

interface MemoryMessagesOptions {
  readonly channels: Pick<MemoryChannelsSection, "findChannel" | "listChannels">;
  readonly identities: Pick<IdentitiesSection, "listIdentities">;
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

type ParentChange = (parent: TopLevelMessage) => Option.Option<TopLevelMessage>;

type Changed<Value> = readonly [Value, MemoryMessages];

function isTopLevel(message: Message): message is TopLevelMessage {
  return message.kind === "top-level";
}

function parentOf(messages: readonly Message[], id: MessageId): Option.Option<TopLevelMessage> {
  return pipe(
    findMessage(messages, id),
    Option.flatMap((found) => Arr.findFirst(messages, (message) => message.id === threadIdOf(found))),
    Option.filter(isTopLevel),
  );
}

function withStored(messages: readonly Message[], parent: TopLevelMessage): readonly Message[] {
  return Arr.map(messages, (message) => {
    if (message.id === parent.id) {
      return parent;
    }
    return message;
  });
}

function closing(closed: Closing): ParentChange {
  return (parent) =>
    Option.map(
      Option.liftPredicate(parent, ({ closedAt }) => Predicate.isUndefined(closedAt)),
      (open) => ({ ...open, ...closed }),
    );
}

function reopening(parent: TopLevelMessage): Option.Option<TopLevelMessage> {
  return Option.map(
    Option.liftPredicate(parent, ({ closedAt }) => Predicate.isNotUndefined(closedAt)),
    reopened,
  );
}

function changeParent(data: MemoryMessages, parent: TopLevelMessage, change: ParentChange): Changed<ThreadStateChange> {
  return Option.match(change(parent), {
    onNone: () => [{ changed: false, parent: current(data.messages, parent) }, data],
    onSome: (changed) => {
      const messages = withStored(data.messages, changed);
      return [
        { changed: true, parent: current(messages, changed) },
        { ...data, messages },
      ];
    },
  });
}

function changeThread(
  data: MemoryMessages,
  id: MessageId,
  change: ParentChange,
): Changed<Option.Option<ThreadStateChange>> {
  return Option.match(parentOf(data.messages, id), {
    onNone: () => [Option.none(), data],
    onSome: (parent) => {
      const [result, next] = changeParent(data, parent, change);
      return [Option.some(result), next];
    },
  });
}

function changeFound(
  data: MemoryMessages,
  id: MessageId,
  change: ParentChange,
): Changed<ThreadStateChange | undefined> {
  const [result, next] = changeThread(data, id, change);
  return [Option.getOrUndefined(result), next];
}

function reopenedBy(data: MemoryMessages, stored: Message): Changed<Option.Option<TopLevelMessage>> {
  if (stored.kind === "top-level") {
    return [Option.none(), data];
  }
  const [result, next] = changeThread(data, stored.id, reopening);
  const parent = Option.flatMap(result, (change) => Option.liftPredicate(change.parent, () => change.changed));
  return [parent, next];
}

function append(data: MemoryMessages, appending: Mentioning): readonly [AppendMessageResult, MemoryMessages] {
  const placement = placementOf(data.messages, appending.message);
  if (!isPlaced(placement)) {
    return [placement, data];
  }
  const last = data.last + NEXT;
  const message = withKnownMentions(appending);
  const stored = placed({ id: asMessageId(last), message, placement });
  const [reopenedParent, { messages }] = reopenedBy({ ...data, messages: [...data.messages, stored] }, stored);
  const [receipts, inbox] = afterAppend({ inbox: data.inbox, message: stored, messages });
  return [
    { message: stored, receipts, reopened: Option.getOrUndefined(reopenedParent), status: "appended" },
    { inbox, last, messages },
  ];
}

function threadIn(messages: readonly Message[], id: MessageId): StoredThread | undefined {
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

function pageIn(messages: readonly Message[], channel: ChannelName, page: ChannelPageRequest): StoredPage {
  const { before = Number.MAX_SAFE_INTEGER, limit } = page;
  const older = Arr.filter(
    messages,
    (message): message is TopLevelMessage =>
      message.kind === "top-level" && message.channel === channel && message.id < before,
  );
  const shown = Arr.takeRight(older, limit);
  return { hasMore: older.length > shown.length, messages: Arr.map(shown, (parent) => current(messages, parent)) };
}

type MemoryMessagesSection = MessagesSection &
  MemoryInboxSection & {
    readonly forgetChannel: (channel: ChannelName) => Fails<ReadonlySet<MessageId>>;
    readonly forgetIdentity: (identity: Author["name"]) => Fails<void>;
    readonly countMessagesBy: (identity: Author["name"]) => Fails<number>;
  };

function withoutMessagesIn(
  data: MemoryMessages,
  channel: ChannelName,
): readonly [ReadonlySet<MessageId>, MemoryMessages] {
  const gone = Arr.filter(data.messages, (message) => message.channel === channel);
  const kept = Arr.filter(data.messages, (message) => message.channel !== channel);
  const ids = new Set(Arr.map(gone, (message) => message.id));
  return [ids, { ...data, inbox: withoutChannel({ channel, ids, inbox: data.inbox }), messages: kept }];
}

function namesAuthor(identity: Author["name"]): (message: Message) => boolean {
  return ({ author }) => author.name === identity || author.owner === identity;
}

type Listed = Effect.Success<ReturnType<IdentitiesSection["listIdentities"]>>;

function activeNamesOf(listed: Listed): Mentioning["known"] {
  const active = Arr.filter(listed, (identity) => identity.deactivated !== true);
  return new Set(Arr.map(active, (identity) => identity.name));
}

function memoryMessages({ channels, identities, state }: MemoryMessagesOptions): MemoryMessagesSection {
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
  const knownNames: Fails<Mentioning["known"]> = Effect.map(identities.listIdentities(), activeNamesOf);
  return {
    ...memoryInbox({
      changeInbox: (work) =>
        change((data) => {
          const [value, inbox] = work(data);
          return [value, { ...data, inbox }];
        }),
      channelExists,
      listChannels: channels.listChannels,
      read: readBoard,
    }),
    appendMessage: (message) =>
      Effect.flatMap(channelExists(message.channel), (exists): Fails<AppendMessageResult> => {
        if (exists) {
          return Effect.flatMap(knownNames, (known) => change((data) => append(data, { known, message })));
        }
        return Effect.succeed(CHANNEL_NOT_FOUND);
      }),
    closeThread: (id, closed) => change((data) => changeFound(data, id, closing(closed))),
    countMessagesBy: (identity) => read((messages) => Arr.filter(messages, namesAuthor(identity)).length),
    forgetChannel: (channel) => change((data) => withoutMessagesIn(data, channel)),
    forgetIdentity: (identity) =>
      Effect.asVoid(change((data) => [true, { ...data, inbox: withoutIdentity({ identity, inbox: data.inbox }) }])),
    getThread: (id) => read((messages) => threadIn(messages, id)),
    latestMessageId: readBoard(({ last }) => Option.getOrUndefined(Option.liftPredicate(last, isMessageId))),
    listChannelMessages: (channel, page) =>
      Effect.flatMap(channelExists(channel), (exists) => {
        if (exists) {
          return read((messages) => pageIn(messages, channel, page));
        }
        return Effect.undefined;
      }),
    reopenThread: (id) => change((data) => changeFound(data, id, reopening)),
  };
}

export { memoryMessages };
