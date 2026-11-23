import type { AgentSessionResponse, JoinRequest } from "../../index.ts";
import { Context, DateTime, Duration, Effect, Layer, Option } from "effect";
import type { Identity, IdentityName, TokenHash } from "../../../identities/index.ts";
import { agentSessionExpired, agentSessionRevoked } from "../../index.ts";
import { agentSessionLive, idleExpiryTooLong, notYourIdentity, onlyAgentsJoin } from "./refusals.ts";
import { defaultIdleSeconds, idleSecondsOf } from "./idle-expiry.ts";
import type { Config } from "effect";
import type { Refusal } from "../../../http/index.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { maxIdleExpiry } from "../../../config/server.ts";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

interface Join extends Omit<JoinRequest, "as"> {
  readonly as: IdentityName;
}

interface AgentSessionsService {
  readonly join: (caller: Identity, request: Join) => Fails<AgentSessionResponse>;
  readonly leave: (hash: TokenHash) => Effect.Effect<void, StorageUnavailable>;
  readonly untilEnded: (hash: TokenHash) => Effect.Effect<Refusal, StorageUnavailable>;
}

class AgentSessions extends Context.Service<AgentSessions, AgentSessionsService>()(
  "@ai-hero/cookout/agent-sessions/lib/server/service/AgentSessions",
) {}

interface On {
  readonly maxIdle: string;
  readonly ceilingSeconds: number;
  readonly secrets: Secrets["Service"];
  readonly storage: Storage["Service"];
}

interface Issue {
  readonly caller: Identity;
  readonly force: boolean;
  readonly idleSeconds: number;
}

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

function idleSecondsFor({ ceilingSeconds, maxIdle }: On, asked: string): Effect.Effect<number, Refusal> {
  const idleSeconds = idleSecondsOf(asked);
  if (idleSeconds > ceilingSeconds) {
    return Effect.fail(idleExpiryTooLong(maxIdle));
  }
  return Effect.succeed(idleSeconds);
}

function checkCaller(caller: Identity, request: Join): Effect.Effect<void, Refusal> {
  if (request.as !== caller.name) {
    return Effect.fail(notYourIdentity({ asked: request.as, caller: caller.name }));
  }
  if (caller.kind === "human") {
    return Effect.fail(onlyAgentsJoin(caller.name));
  }
  return Effect.void;
}

function issuer({ secrets, storage }: On) {
  return ({ caller, force, idleSeconds }: Issue): Fails<AgentSessionResponse> =>
    Effect.gen(function* issueAgentSession() {
      const agentSessionToken = yield* secrets.newToken;
      const hash = yield* secrets.hashToken(agentSessionToken);
      const now = yield* DateTime.now;
      const times = { expiresAt: isoTimeOf(DateTime.add(now, { seconds: idleSeconds })), issuedAt: isoTimeOf(now) };
      const session = { ...times, hash, identity: caller.name, idleSeconds };
      const issued = yield* storage.issueAgentSession({ force, session });
      if (issued.status === "live") {
        return yield* Effect.fail(agentSessionLive({ expiresAt: issued.expiresAt, identity: caller.name }));
      }
      return { ...times, agentSessionToken };
    });
}

function joiner(on: On) {
  const issue = issuer(on);
  return (caller: Identity, request: Join): Fails<AgentSessionResponse> =>
    Effect.gen(function* joinAs() {
      yield* checkCaller(caller, request);
      const idleSeconds = yield* Option.match(Option.fromUndefinedOr(request.idleExpiry), {
        onNone: () => Effect.succeed(Math.min(defaultIdleSeconds, on.ceilingSeconds)),
        onSome: (asked) => idleSecondsFor(on, asked),
      });
      return yield* issue({ caller, force: request.force === true, idleSeconds });
    });
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

function agentSessionsOn(on: On): AgentSessionsService {
  return { join: joiner(on), leave: on.storage.revokeAgentSession, untilEnded: watcher(on) };
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
