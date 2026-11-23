import { Array as Arr, Option, Order } from "effect";
import type { Message, MessageId, ReadReceipt } from "../../../messages/index.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { ReadPosition } from "../../../inbox/index.ts";
import { receiptIdentitiesOf } from "../../../messages/index.ts";
import { scopeOf } from "./inbox.ts";

interface Recording {
  readonly messages: readonly Message[];
  readonly receipts: readonly ReadReceipt[];
  readonly identity: IdentityName;
  readonly position: ReadPosition;
  readonly at: Message["createdAt"];
}

const byMessageThenIdentity: Order.Order<ReadReceipt> = Order.combine(
  Order.mapInput(Order.Number, (receipt: ReadReceipt) => receipt.messageId),
  Order.mapInput(Order.String, (receipt: ReadReceipt) => receipt.identity),
);

function parentAuthorOf(messages: readonly Message[], message: Message): IdentityName | undefined {
  const parent = Arr.findFirst(messages, (other) => message.kind === "reply" && other.id === message.replyTo);
  return Option.getOrUndefined(Option.map(parent, (found) => found.author.name));
}

function passedBy(position: ReadPosition, message: Message): boolean {
  const { channel, thread } = scopeOf(message);
  return channel === position.channel && thread === position.thread && message.id <= position.messageId;
}

function isReceiptIdentity(messages: readonly Message[], message: Message, identity: IdentityName): boolean {
  return Arr.contains(receiptIdentitiesOf({ message, parentAuthor: parentAuthorOf(messages, message) }), identity);
}

function recordReceiptsIn({
  at,
  identity,
  messages,
  position,
  receipts,
}: Recording): readonly [readonly ReadReceipt[], readonly ReadReceipt[]] {
  const passed = Arr.filter(
    messages,
    (message) =>
      passedBy(position, message) &&
      isReceiptIdentity(messages, message, identity) &&
      !Arr.some(receipts, (receipt) => receipt.messageId === message.id && receipt.identity === identity),
  );
  const recorded = Arr.map(
    passed,
    (message): ReadReceipt => ({ identity, messageId: message.id, seen: true, seenAt: at }),
  );
  return [recorded, [...receipts, ...recorded]];
}

interface Listing {
  readonly ids: readonly MessageId[];
  readonly receipts: readonly ReadReceipt[];
}

function receiptsOf({ ids, receipts }: Listing): readonly ReadReceipt[] {
  const wanted = new Set(ids);
  return Arr.sort(
    Arr.filter(receipts, (receipt) => wanted.has(receipt.messageId)),
    byMessageThenIdentity,
  );
}

export { receiptsOf, recordReceiptsIn };
