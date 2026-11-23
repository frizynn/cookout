import type { AckedInbox, AckedMessage, Scope } from "./inbox.ts";
import { Array as Arr, Option, Order } from "effect";
import type { Message, MessageId } from "../../../messages/index.ts";
import type { MovedBackReadPosition, ReadPosition } from "../../../inbox/index.ts";
import { movedBackTo, movedTo, scopeOf } from "./inbox.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { MemoryInbox } from "./inbox-memory-state.ts";
import { recordReceiptsIn } from "./read-receipts-memory.ts";

const NO_THREAD = 0;

interface PositionsIn {
  readonly messages: readonly Message[];
  readonly positionOf: (scope: Scope) => MessageId | undefined;
}

const byScope: Order.Order<ReadPosition> = Order.combine(
  Order.mapInput(Order.String, (position: ReadPosition) => position.channel),
  Order.mapInput(Order.Number, (position: ReadPosition) => position.thread ?? NO_THREAD),
);

function scopesOf(messages: readonly Message[]): readonly Scope[] {
  const channels = Arr.dedupe(Arr.map(messages, (message) => message.channel));
  const threads = Arr.filter(messages, (message) => message.kind !== "reply");
  return [
    ...Arr.map(channels, (channel) => ({ channel, thread: null })),
    ...Arr.map(threads, (message) => ({ channel: message.channel, thread: message.id })),
  ];
}

function readPositionsIn({ messages, positionOf }: PositionsIn): readonly ReadPosition[] {
  const positions = Arr.flatMap(scopesOf(messages), (scope) => {
    const found = Option.fromUndefinedOr(positionOf(scope));
    return Option.match(found, { onNone: () => [], onSome: (messageId) => [{ ...scope, messageId }] });
  });
  return Arr.sort(positions, byScope);
}

interface MovingBackIn {
  readonly key: string;
  readonly message: Message;
  readonly messages: readonly Message[];
  readonly positions: ReadonlyMap<string, MessageId>;
}

function inSameScope(first: Message, second: Message): boolean {
  const [one, two] = [scopeOf(first), scopeOf(second)];
  return one.channel === two.channel && one.thread === two.thread;
}

function moveBackIn({
  key,
  message,
  messages,
  positions,
}: MovingBackIn): readonly [MovedBackReadPosition, ReadonlyMap<string, MessageId>] {
  const earlier = Arr.filter(messages, (other) => other.id < message.id && inSameScope(other, message));
  const previous = Option.getOrUndefined(Option.map(Arr.last(earlier), (other) => other.id));
  const position = movedBackTo({ current: positions.get(key), message, previous });
  const next = new Map(positions);
  next.delete(key);
  return [
    position,
    Option.match(Option.fromNullOr(position.messageId), { onNone: () => next, onSome: (id) => next.set(key, id) }),
  ];
}

interface AckingIn {
  readonly at: Message["createdAt"];
  readonly identity: IdentityName;
  readonly inbox: MemoryInbox;
  readonly key: string;
  readonly message: Message;
  readonly messages: readonly Message[];
}

function ackIn({ at, identity, inbox, key, message, messages }: AckingIn): readonly [AckedMessage, MemoryInbox] {
  const readPosition = movedTo({ current: inbox.positions.get(key), message });
  const [receipts, kept] = recordReceiptsIn({
    at,
    identity,
    messages,
    position: readPosition,
    receipts: inbox.receipts,
  });
  return [
    { readPosition, receipts },
    { ...inbox, positions: new Map([...inbox.positions, [key, readPosition.messageId]]), receipts: kept },
  ];
}

interface AckingAllIn extends Omit<AckingIn, "key" | "message"> {
  readonly keyFor: (message: Message) => string;
  readonly newest: readonly Message[];
}

function ackAllIn({ keyFor, newest, ...acking }: AckingAllIn): readonly [AckedInbox, MemoryInbox] {
  const start: readonly [AckedInbox, MemoryInbox] = [{ readPositions: [], receipts: [] }, acking.inbox];
  return Arr.reduce(newest, start, ([acked, inbox], message) => {
    const [one, next] = ackIn({ ...acking, inbox, key: keyFor(message), message });
    return [
      { readPositions: [...acked.readPositions, one.readPosition], receipts: [...acked.receipts, ...one.receipts] },
      next,
    ];
  });
}

export { ackAllIn, ackIn, moveBackIn, readPositionsIn };
export { receiptsOf } from "./read-receipts-memory.ts";
