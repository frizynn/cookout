import { Array as Arr, Effect, Order } from "effect";
import type { Message, MessageId, Reaction } from "../../../messages/index.ts";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { InboxItem } from "../../index.ts";
import { reactionCounter } from "../../../messages/server.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

type Store = Storage["Service"];

type StoredItem = Omit<InboxItem, "channel">;

const ONE_AT_A_TIME = { concurrency: 1 } as const;

const byMessageId: Order.Order<StoredItem> = Order.mapInput(Order.Number, (item: StoredItem) => item.message.id);

interface Reacted {
  readonly id: MessageId;
  readonly reactions: readonly Reaction[];
}

interface ForAuthor {
  readonly storage: Store;
  readonly author: IdentityName;
}

interface Counting<Item> {
  readonly storage: Store;
  readonly items: readonly Item[];
}

function reactedMessages(reactions: readonly Reaction[]): readonly Reacted[] {
  const ids = Arr.dedupe(Arr.map(reactions, (reaction) => reaction.messageId));
  return Arr.map(ids, (id) => ({ id, reactions: Arr.filter(reactions, (reaction) => reaction.messageId === id) }));
}

function itemOf(storage: Store, { id, reactions }: Reacted): Fails<readonly StoredItem[]> {
  return Effect.map(storage.getThread(id), (thread) =>
    Arr.flatMap(Arr.fromNullishOr(thread), ({ parent, replies }) =>
      Arr.map(
        Arr.filter([parent, ...replies], (message: Message) => message.id === id),
        (message): StoredItem => ({ message, newReactions: reactions, parent, reasons: ["reaction"] }),
      ),
    ),
  );
}

function reactionItems({ author, storage }: ForAuthor): Fails<readonly StoredItem[]> {
  return Effect.flatMap(storage.listUnseenReactions(author), (reactions) =>
    Effect.map(
      Effect.forEach(reactedMessages(reactions), (reacted) => itemOf(storage, reacted), ONE_AT_A_TIME),
      Arr.flatten,
    ),
  );
}

function reactionItemFor(asking: ForAuthor & { readonly id: MessageId }): Fails<readonly StoredItem[]> {
  return Effect.map(reactionItems(asking), (items) => Arr.filter(items, (item) => item.message.id === asking.id));
}

function withReactionItems({ items, ...asking }: ForAuthor & Counting<StoredItem>): Fails<readonly StoredItem[]> {
  return Effect.map(reactionItems(asking), (reacted) => Arr.sort([...items, ...reacted], byMessageId));
}

function itemsWithReactions<Item extends StoredItem>({ items, storage }: Counting<Item>): Fails<readonly Item[]> {
  const ids = Arr.flatMap(items, (item) => [item.message.id, item.parent.id]);
  return Effect.map(reactionCounter({ shown: ids, storage }), (counted) =>
    Arr.map(items, (item) => ({ ...item, message: counted(item.message), parent: counted(item.parent) })),
  );
}

function seenUpTo({ author, storage, upTo }: ForAuthor & { readonly upTo: MessageId }): Fails<void> {
  return Effect.flatMap(storage.listUnseenReactions(author), (reactions) => {
    const ids = Arr.map(reactions, (reaction) => reaction.messageId);
    return storage.markReactionsSeen(
      author,
      Arr.filter(ids, (id) => id <= upTo),
    );
  });
}

export { itemsWithReactions, reactionItemFor, seenUpTo, withReactionItems };
