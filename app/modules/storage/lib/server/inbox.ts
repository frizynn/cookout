import { Array as Arr, Order, Predicate } from "effect";
import type { InboxItem, InboxReason, ReadPosition } from "../../../inbox/index.ts";
import type { Message, MessageId } from "../../../messages/index.ts";
import type { ChannelName } from "../../../channels/index.ts";
import type { Effect } from "effect";
import type { IdentityName } from "../../../identities/index.ts";
import type { StorageUnavailable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

type StoredInboxItem = Omit<InboxItem, "channel">;

interface Scope {
  readonly channel: ChannelName;
  readonly thread: MessageId | null;
}

interface Moving {
  readonly message: Message;
  readonly current: MessageId | undefined;
}

interface InboxSection {
  readonly listInbox: (identity: IdentityName) => Fails<readonly StoredInboxItem[]>;
  readonly ackMessage: (identity: IdentityName, id: MessageId) => Fails<ReadPosition | undefined>;
  readonly followThread: (identity: IdentityName, id: MessageId) => Fails<MessageId | undefined>;
  readonly unfollowThread: (identity: IdentityName, id: MessageId) => Fails<MessageId | undefined>;
  readonly subscribeChannel: (identity: IdentityName, channel: ChannelName) => Fails<boolean>;
  readonly unsubscribeChannel: (identity: IdentityName, channel: ChannelName) => Fails<boolean>;
}

function scopeOf(message: Message): Scope {
  if (message.kind === "reply") {
    return { channel: message.channel, thread: message.replyTo };
  }
  return { channel: message.channel, thread: null };
}

function movedTo({ current, message }: Moving): ReadPosition {
  if (Predicate.isNotUndefined(current) && current > message.id) {
    return { ...scopeOf(message), messageId: current };
  }
  return { ...scopeOf(message), messageId: message.id };
}

function followersOf(message: Message): readonly IdentityName[] {
  return Arr.dedupe([message.author.name, ...message.mentions]);
}

function reasonsIn(reasons: readonly InboxReason[]): readonly InboxReason[] {
  return Arr.sort(Arr.dedupe(reasons), Order.String);
}

export { type InboxSection, type Scope, type StoredInboxItem, followersOf, movedTo, reasonsIn, scopeOf };
