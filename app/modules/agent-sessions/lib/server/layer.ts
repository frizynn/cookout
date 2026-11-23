import { AgentSessions, agentSessionsOn } from "./service.ts";
import { Effect, Layer, Option, PubSub } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { Config } from "effect";
import { IdentityChanges } from "../../../identities/server.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { idleSecondsOf } from "./idle-expiry.ts";
import { maxIdleExpiry } from "../../../config/server.ts";

const agentSessionsLayer: Layer.Layer<AgentSessions, Config.ConfigError, Storage | Secrets | IdentityChanges> =
  Layer.effect(
    AgentSessions,
    Effect.gen(function* agentSessionsOnStorage() {
      const maxIdle = yield* maxIdleExpiry;
      const storage = yield* Storage;
      const secrets = yield* Secrets;
      const { endTokens, publish: publishIdentity } = yield* IdentityChanges;
      const ceilingSeconds = idleSecondsOf(maxIdle);
      const hub = yield* PubSub.unbounded<Identity>();
      function publishSession(agent: IdentityName): Effect.Effect<void, StorageUnavailable> {
        return Effect.flatMap(storage.findIdentityByName(agent), (found) =>
          Effect.forEach(Option.toArray(Option.fromUndefinedOr(found)), (identity) => PubSub.publish(hub, identity), {
            concurrency: 1,
            discard: true,
          }),
        );
      }
      const on = { ceilingSeconds, endTokens, maxIdle, publishIdentity, publishSession, secrets, storage };
      return { ...agentSessionsOn(on), sessionChanged: PubSub.subscribe(hub) };
    }),
  );

export { agentSessionsLayer };
