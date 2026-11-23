import { Array as Arr, String as Str } from "effect";
import type { ChannelName } from "../../../channels/index.ts";
import type { MessageId } from "../../../messages/index.ts";

interface MemoryInbox {
  readonly mentions: ReadonlySet<string>;
  readonly follows: ReadonlySet<string>;
  readonly subscriptions: ReadonlySet<string>;
  readonly positions: ReadonlyMap<string, MessageId>;
}

const EMPTY_INBOX: MemoryInbox = {
  follows: new Set(),
  mentions: new Set(),
  positions: new Map(),
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
    subscriptions: new Set(Arr.filter([...inbox.subscriptions], kept)),
  };
}

export { EMPTY_INBOX, type MemoryInbox, withoutChannel };
