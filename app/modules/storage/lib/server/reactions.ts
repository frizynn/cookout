import { Array as Arr, Order } from "effect";
import type { MessageId, Reaction, ReactionName } from "../../../messages/index.ts";
import type { Effect } from "effect";
import type { IdentityName } from "../../../identities/index.ts";
import type { StorageUnavailable } from "./errors.ts";
import { reactionNames } from "../../../messages/index.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface NewReaction extends Reaction {
  readonly notifiesAuthor: boolean;
}

type ReactionKey = Pick<Reaction, "identity" | "messageId" | "reaction">;

interface ReactionsSection {
  readonly addReaction: (reaction: NewReaction) => Fails<boolean | undefined>;
  readonly removeReaction: (key: ReactionKey) => Fails<boolean | undefined>;
  readonly listReactions: (ids: readonly MessageId[]) => Fails<readonly Reaction[]>;
  readonly listUnseenReactions: (author: IdentityName) => Fails<readonly Reaction[]>;
  readonly markReactionsSeen: (author: IdentityName, ids: readonly MessageId[]) => Fails<void>;
}

function rankOf(reaction: ReactionName): number {
  return reactionNames.indexOf(reaction);
}

const byMessageThenTime: Order.Order<Reaction> = Order.combine(
  Order.combine(
    Order.mapInput(Order.Number, (reaction: Reaction) => reaction.messageId),
    Order.mapInput(Order.String, (reaction: Reaction) => reaction.reactedAt),
  ),
  Order.combine(
    Order.mapInput(Order.String, (reaction: Reaction) => reaction.identity),
    Order.mapInput(Order.Number, (reaction: Reaction) => rankOf(reaction.reaction)),
  ),
);

function sortedReactions(reactions: readonly Reaction[]): readonly Reaction[] {
  return Arr.sort(reactions, byMessageThenTime);
}

export { type NewReaction, type ReactionKey, type ReactionsSection, sortedReactions };
