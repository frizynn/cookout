import { Array as Arr, String as Str } from "effect";
import type { MessageId, ReadReceipt } from "../../../messages/index.ts";
import type { ChannelName } from "../../../channels/index.ts";

interface MemoryInbox {
  readonly mentions: ReadonlySet<string>;
  readonly follows: ReadonlySet<string>;
  readonly subscriptions: ReadonlySet<string>;
  readonly positions: ReadonlyMap<string, MessageId>;
  readonly receipts: readonly ReadReceipt[];
}

const EMPTY_INBOX: MemoryInbox = {
  follows: new Set(),
  mentions: new Set(),
  positions: new Map(),
  receipts: [],
  subscriptions: new Set(),
};

interface ForgettingChannel {
  readonly inbox: MemoryInbox;
  readonly channel: ChannelName;
  readonly ids: ReadonlySet<MessageId>;
}

function withoutChannel({ channel, ids, inbox }: ForgettingChannel): MemoryInbox {
  const gone = [` channel ${channel}`, ...Arr.flatMap([...ids], (id) => [` thread ${id}`, ` message ${id}`])];
  function kept(key: string): boolean {
    return !Arr.some(gone, (scope) => Str.endsWith(scope)(key));
  }
  return {
    follows: new Set(Arr.filter([...inbox.follows], kept)),
    mentions: new Set(Arr.filter([...inbox.mentions], kept)),
    positions: new Map(Arr.filter([...inbox.positions], ([key]: readonly [string, MessageId]) => kept(key))),
    receipts: Arr.filter(inbox.receipts, (receipt) => !ids.has(receipt.messageId)),
    subscriptions: new Set(Arr.filter([...inbox.subscriptions], kept)),
  };
}

interface ForgettingIdentity {
  readonly inbox: MemoryInbox;
  readonly identity: string;
}

function withoutIdentity({ identity, inbox }: ForgettingIdentity): MemoryInbox {
  function kept(key: string): boolean {
    return !Str.startsWith(`${identity} `)(key);
  }
  return {
    follows: new Set(Arr.filter([...inbox.follows], kept)),
    mentions: new Set(Arr.filter([...inbox.mentions], kept)),
    positions: new Map(Arr.filter([...inbox.positions], ([key]: readonly [string, MessageId]) => kept(key))),
    receipts: Arr.filter(inbox.receipts, (receipt) => receipt.identity !== identity),
    subscriptions: new Set(Arr.filter([...inbox.subscriptions], kept)),
  };
}

export { EMPTY_INBOX, type MemoryInbox, withoutChannel, withoutIdentity };
