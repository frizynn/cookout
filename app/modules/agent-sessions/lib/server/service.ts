import type { AgentAt, StorageUnavailable } from "../../../storage/server.ts";
import type { AgentSessionResponse, ListAgentSessionsResponse, RevokeAgentSessionResponse } from "../../index.ts";
import { Context, DateTime, Duration, Effect, Layer, Option } from "effect";
import type { Identity, IdentityName, TokenHash } from "../../../identities/index.ts";
import type { Join, On } from "./join.ts";
import { agentSessionExpired, agentSessionRevoked } from "../../index.ts";
import type { Config } from "effect";
import type { Refusal } from "../../../http/index.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import { idleSecondsOf } from "./idle-expiry.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { joiner } from "./join.ts";
import { maxIdleExpiry } from "../../../config/server.ts";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

interface AgentSessionsService {
  readonly join: (caller: Identity, request: Join) => Fails<AgentSessionResponse>;
  readonly leave: (hash: TokenHash) => Effect.Effect<void, StorageUnavailable>;
  readonly untilEnded: (hash: TokenHash) => Effect.Effect<Refusal, StorageUnavailable>;
  readonly listFor: (identity: IdentityName) => Effect.Effect<ListAgentSessionsResponse, StorageUnavailable>;
  readonly revokeFor: (identity: IdentityName) => Effect.Effect<RevokeAgentSessionResponse, StorageUnavailable>;
}

class AgentSessions extends Context.Service<AgentSessions, AgentSessionsService>()(
  "@ai-hero/cookout/agent-sessions/lib/server/service/AgentSessions",
) {}

const CHECK_SECONDS = 30;
const UNAUTHORIZED = 401;

const endedRefusals: Readonly<Record<"expired" | "revoked", Refusal>> = {
  expired: {
    code: agentSessionExpired,
    message: "This session's agent session token expired. Join again.",
    status: UNAUTHORIZED,
  },
  revoked: {
    code: agentSessionRevoked,
    message: "This session's agent session token was revoked. Join again.",
    status: UNAUTHORIZED,
  },
};

function endedRefusal(status: string): Refusal {
  if (status === "expired") {
    return endedRefusals.expired;
  }
  return endedRefusals.revoked;
}

function watcher({ storage }: On) {
  return (hash: TokenHash): Effect.Effect<Refusal, StorageUnavailable> => {
    const check = Effect.flatMap(DateTime.now, (now) => storage.useAgentSession({ hash, now: isoTimeOf(now) }));
    return Effect.delay(check, Duration.seconds(CHECK_SECONDS)).pipe(
      Effect.repeat({ until: (used) => used.status !== "active" }),
      Effect.map(({ status }) => endedRefusal(status)),
    );
  };
}

function agentNow(identity: IdentityName): Effect.Effect<AgentAt> {
  return Effect.map(DateTime.now, (now) => ({ identity, now: isoTimeOf(now) }));
}

function ownerViews({ storage }: On): Pick<AgentSessionsService, "listFor" | "revokeFor"> {
  return {
    listFor: (identity) =>
      agentNow(identity).pipe(
        Effect.flatMap(storage.findLiveAgentSession),
        Effect.map((live) => ({ agentSessions: Option.toArray(live) })),
      ),
    revokeFor: (identity) =>
      agentNow(identity).pipe(
        Effect.flatMap(storage.revokeLiveAgentSession),
        Effect.map((revoked) => ({ revoked })),
      ),
  };
}

function agentSessionsOn(on: On): AgentSessionsService {
  return { join: joiner(on), leave: on.storage.revokeAgentSession, untilEnded: watcher(on), ...ownerViews(on) };
}

const agentSessionsLayer: Layer.Layer<AgentSessions, Config.ConfigError, Storage | Secrets> = Layer.effect(
  AgentSessions,
  Effect.gen(function* agentSessionsOnStorage() {
    const maxIdle = yield* maxIdleExpiry;
    const storage = yield* Storage;
    const secrets = yield* Secrets;
    const ceilingSeconds = idleSecondsOf(maxIdle);
    return agentSessionsOn({ ceilingSeconds, maxIdle, secrets, storage });
  }),
);

export { AgentSessions, agentSessionsLayer };
