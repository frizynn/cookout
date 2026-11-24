import type { AppendMessageResult, MessagesSection } from "./messages.ts";
import type { CommandCallsSection } from "./command-calls.ts";
import { Effect } from "effect";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { PresenceSection } from "./presence.ts";
import type { ReactionsSection } from "./reactions.ts";
import type { StorageUnavailable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

type RecordActivity = (identity: IdentityName, at: IsoTime) => Fails<void>;

type ActivityWrites = Pick<PresenceSection, "recordPresence"> &
  Pick<MessagesSection, "appendMessage"> &
  Pick<CommandCallsSection, "appendCommandCall"> &
  Pick<ReactionsSection, "addReaction">;

function postedBy(record: RecordActivity): (result: AppendMessageResult) => Fails<void> {
  return (result) => {
    if (result.status !== "appended") {
      return Effect.void;
    }
    return record(result.message.author.name, result.message.createdAt);
  };
}

function recordingActivity(writes: ActivityWrites, record: RecordActivity): ActivityWrites {
  return {
    addReaction: (reaction) =>
      Effect.tap(writes.addReaction(reaction), (added) => {
        if (added !== true) {
          return Effect.void;
        }
        return record(reaction.identity, reaction.reactedAt);
      }),
    appendCommandCall: (call) => Effect.tap(writes.appendCommandCall(call), postedBy(record)),
    appendMessage: (message) => Effect.tap(writes.appendMessage(message), postedBy(record)),
    recordPresence: (presence) =>
      Effect.andThen(writes.recordPresence(presence), record(presence.identity, presence.lastSeenAt)),
  };
}

interface Recording<Store> {
  readonly store: Store;
  readonly record: RecordActivity;
}

function withActivity<Store extends ActivityWrites>({ record, store }: Recording<Store>): Store {
  return { ...store, ...recordingActivity(store, record) };
}

export { type RecordActivity, withActivity };
