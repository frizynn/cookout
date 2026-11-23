import type { CommandTokenGrant, Storage, StorageUnavailable } from "../../../storage/server.ts";
import { DateTime, Effect, Function, Option, Predicate } from "effect";
import type { Identity, TokenHash } from "../../index.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Refusal } from "../../../http/index.ts";

const tokenUnknown: Refusal = {
  code: "token_unknown",
  message: "This token is not known to this cookout.",
  status: 401,
};

const tokenExpired: Refusal = {
  code: "token_expired",
  message: "This command token expired 24 h after its call.",
  status: 401,
};

interface Principal {
  readonly identity: Identity;
  readonly commandThread: Option.Option<MessageId>;
  readonly agentSession: Option.Option<TokenHash>;
}

function grantPrincipal(grant: CommandTokenGrant): Effect.Effect<Principal, Refusal> {
  return Effect.gen(function* checkCommandToken() {
    const now = yield* DateTime.now;
    if (DateTime.isGreaterThanOrEqualTo(now, DateTime.makeUnsafe(grant.expiresAt))) {
      return yield* Effect.fail(tokenExpired);
    }
    return { agentSession: Option.none(), commandThread: Option.some(grant.threadId), identity: grant.handler };
  });
}

interface LoginLookup {
  readonly hash: TokenHash;
  readonly storage: Storage["Service"];
}

function commandTokenPrincipal({ hash, storage }: LoginLookup) {
  return (grant: CommandTokenGrant | undefined): Effect.Effect<Principal, Refusal | StorageUnavailable> => {
    if (Predicate.isUndefined(grant)) {
      return storage.findLoginCredential(hash).pipe(
        Effect.filterOrFail(Predicate.isNotUndefined, Function.constant(tokenUnknown)),
        Effect.map((identity) => ({ agentSession: Option.none(), commandThread: Option.none(), identity })),
      );
    }
    return grantPrincipal(grant);
  };
}

export { type Principal, commandTokenPrincipal };
