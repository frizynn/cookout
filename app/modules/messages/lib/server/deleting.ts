import { Array as Arr, DateTime, Effect, Option } from "effect";
import type { Message, MessageId } from "../../index.ts";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import { messageNotFound, notOwnMessage } from "./refusals.ts";
import type { DeletedMessageResponse } from "../../client.ts";
import type { Identity } from "../../../identities/index.ts";
import type { Refusal } from "../../../http/index.ts";
import { isoTimeOf } from "../../../time/server.ts";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

type OneAtATime = <Value, Failure, Needs>(
  effect: Effect.Effect<Value, Failure, Needs>,
) => Effect.Effect<Value, Failure, Needs>;

interface DeletingOn {
  readonly storage: Storage["Service"];
  readonly oneAtATime: OneAtATime;
}

interface Asking {
  readonly caller: Identity;
  readonly message: Message;
}

function mayDelete({ caller, message }: Asking): boolean {
  if (message.author.name === caller.name) {
    return true;
  }
  return caller.kind === "human" && caller.admin;
}

function present(id: MessageId, found: Option.Option<Message>): Fails<Message> {
  return Effect.mapError(Effect.fromOption(found), () => messageNotFound(String(id)));
}

function messageIn(storage: Storage["Service"], id: MessageId): Fails<Message> {
  return Effect.flatMap(storage.getThread(id), (thread) => {
    const inThread: readonly Message[] = Arr.flatMap(Arr.fromNullishOr(thread), (found) => [
      found.parent,
      ...found.replies,
    ]);
    return present(
      id,
      Arr.findFirst(inThread, (message) => message.id === id),
    );
  });
}

function deleteMessageWith({ oneAtATime, storage }: DeletingOn) {
  return (caller: Identity, id: MessageId): Fails<DeletedMessageResponse> =>
    Effect.gen(function* deleteMessage() {
      const message = yield* messageIn(storage, id);
      if (!mayDelete({ caller, message })) {
        return yield* Effect.fail(notOwnMessage);
      }
      const now = yield* DateTime.now;
      const deleting = { deletedAt: isoTimeOf(now), deletedBy: caller.name };
      const gone = yield* oneAtATime(storage.deleteMessage(id, deleting));
      return { message: yield* present(id, Option.fromUndefinedOr(gone)) };
    });
}

export { deleteMessageWith };
