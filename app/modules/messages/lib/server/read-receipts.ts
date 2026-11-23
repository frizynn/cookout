import { Array as Arr, Context, Effect, Layer, Option, PubSub } from "effect";
import type { ListMessagesResponse, Message, ReadReceipt, ThreadResponse } from "../../index.ts";
import type { Storage, StorageUnavailable, StoredPage, StoredThread } from "../../../storage/server.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { Scope } from "effect";
import { receiptIdentitiesOf } from "../../index.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface ReadReceiptsService {
  readonly publish: (receipts: readonly ReadReceipt[]) => Effect.Effect<void>;
  readonly recorded: Effect.Effect<PubSub.Subscription<ReadReceipt>, never, Scope.Scope>;
}

class ReadReceipts extends Context.Service<ReadReceipts, ReadReceiptsService>()(
  "@ai-hero/cookout/messages/lib/server/read-receipts/ReadReceipts",
) {}

const readReceiptsLayer: Layer.Layer<ReadReceipts> = Layer.effect(
  ReadReceipts,
  Effect.gen(function* readReceiptsHub() {
    const hub = yield* PubSub.unbounded<ReadReceipt>();
    return {
      publish: (receipts: readonly ReadReceipt[]) => Effect.asVoid(PubSub.publishAll(hub, receipts)),
      recorded: PubSub.subscribe(hub),
    };
  }),
);

interface Receipted {
  readonly messages: readonly Message[];
  readonly parentAuthor?: IdentityName | undefined;
  readonly seen: readonly ReadReceipt[];
}

function receiptsOf({ messages, parentAuthor, seen }: Receipted): readonly ReadReceipt[] {
  return Arr.flatMap(messages, (message) =>
    Arr.map(receiptIdentitiesOf({ message, parentAuthor }), (identity) =>
      Option.getOrElse(
        Arr.findFirst(seen, (receipt) => receipt.messageId === message.id && receipt.identity === identity),
        (): ReadReceipt => ({ identity, messageId: message.id, seen: false }),
      ),
    ),
  );
}

function seenIn(storage: Storage["Service"], messages: readonly Message[]): Fails<readonly ReadReceipt[]> {
  return storage.listReadReceipts(Arr.map(messages, (message) => message.id));
}

interface Reading<Stored> {
  readonly storage: Storage["Service"];
  readonly stored: Stored;
}

function pageWithReceipts({ storage, stored }: Reading<StoredPage>): Fails<ListMessagesResponse> {
  const { hasMore, messages } = stored;
  return Effect.map(seenIn(storage, messages), (seen) => ({
    hasMore,
    messages,
    receipts: receiptsOf({ messages, seen }),
  }));
}

function threadWithReceipts({ storage, stored }: Reading<StoredThread>): Fails<ThreadResponse> {
  const { parent, replies } = stored;
  return Effect.map(seenIn(storage, [parent, ...replies]), (seen) => ({
    parent,
    receipts: [
      ...receiptsOf({ messages: [parent], seen }),
      ...receiptsOf({ messages: replies, parentAuthor: parent.author.name, seen }),
    ],
    replies,
  }));
}

export { ReadReceipts, pageWithReceipts, readReceiptsLayer, threadWithReceipts };
