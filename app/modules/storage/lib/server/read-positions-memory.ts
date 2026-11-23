import { Array as Arr, Option, Order } from "effect";
import type { Message, MessageId } from "../../../messages/index.ts";
import type { ReadPosition } from "../../../inbox/index.ts";
import type { Scope } from "./inbox.ts";

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

export { readPositionsIn };
