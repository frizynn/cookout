import { AgentSessions, agentSessionsOn } from "./service.ts";
import { Effect, Layer } from "effect";
import type { Config } from "effect";
import { IdentityChanges } from "../../../identities/server.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import { idleSecondsOf } from "./idle-expiry.ts";
import { maxIdleExpiry } from "../../../config/server.ts";

const agentSessionsLayer: Layer.Layer<AgentSessions, Config.ConfigError, Storage | Secrets | IdentityChanges> =
  Layer.effect(
    AgentSessions,
    Effect.gen(function* agentSessionsOnStorage() {
      const maxIdle = yield* maxIdleExpiry;
      const storage = yield* Storage;
      const secrets = yield* Secrets;
      const { publish: publishIdentity } = yield* IdentityChanges;
      const ceilingSeconds = idleSecondsOf(maxIdle);
      return agentSessionsOn({ ceilingSeconds, maxIdle, publishIdentity, secrets, storage });
    }),
  );

export { agentSessionsLayer };
