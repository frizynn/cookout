import { DateTime, Effect, Predicate } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { CallCommandResponse } from "../../index.ts";
import { IdentityChanges } from "../../../identities/server.ts";
import { Messages } from "../../../messages/server.ts";
import type { PostMessage } from "./spawn-agent.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { spawnAgentCommand } from "./spawn-agent.ts";

interface SpawnThread {
  readonly channel: PostMessage["channel"];
  readonly threadId: CallCommandResponse["threadId"];
}

type ReplyNeeds = Storage | Secrets | Messages;

function handlerOf(adminName: IdentityName): Effect.Effect<Identity, StorageUnavailable, Storage | Secrets> {
  return Effect.gen(function* findOrMakeHandler() {
    const storage = yield* Storage;
    const found = yield* storage.findIdentityByName(spawnAgentCommand.handler);
    if (Predicate.isNotUndefined(found)) {
      return found;
    }
    const secrets = yield* Secrets;
    const hash = yield* Effect.flatMap(secrets.newToken, secrets.hashToken);
    const now = yield* DateTime.now;
    const handler: Identity = {
      admin: false,
      createdAt: isoTimeOf(now),
      kind: "agent",
      name: spawnAgentCommand.handler,
      owner: adminName,
    };
    yield* storage.createIdentity(handler, hash);
    return handler;
  });
}

interface Replying {
  readonly adminName: IdentityName;
  readonly thread: SpawnThread;
}

function replierIn({ adminName, thread }: Replying): (text: string) => Effect.Effect<void, never, ReplyNeeds> {
  return (text) =>
    Effect.gen(function* reply() {
      const handler = yield* handlerOf(adminName);
      const messages = yield* Messages;
      yield* messages.post(handler, { channel: thread.channel, replyTo: thread.threadId, text });
    }).pipe(
      Effect.ignore({ log: "Warn", message: `The /spawn-agent reply in thread ${thread.threadId} wasn't posted.` }),
    );
}

function deactivated(name: IdentityName): Effect.Effect<void, never, Storage | IdentityChanges> {
  return Effect.gen(function* deactivateSpawned() {
    const storage = yield* Storage;
    yield* storage.deactivateIdentity(name);
    const found = yield* storage.findIdentityByName(name);
    if (Predicate.isNotUndefined(found)) {
      const changes = yield* IdentityChanges;
      yield* changes.publish(found);
    }
  }).pipe(Effect.ignore({ log: "Warn", message: `The spawned agent ${name} wasn't deactivated.` }));
}

export { type ReplyNeeds, type SpawnThread, deactivated, replierIn };
