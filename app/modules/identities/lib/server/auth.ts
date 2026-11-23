import type { CommandTokenGrant, Storage, StorageUnavailable, TokenLookup } from "../../../storage/server.ts";
import { Context, DateTime, Effect, Option, Predicate, String as Str } from "effect";
import type { Identity, Token, TokenHash } from "../../index.ts";
import { sessionCookieName, token } from "../../index.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Refusal } from "../../../http/index.ts";
import { Secrets } from "../../../secrets/server.ts";
import { messagesPath } from "../../../messages/index.ts";

const bearer = /^Bearer +(\S+)\s*$/iu;

const tokenMissing: Refusal = {
  code: "token_missing",
  message: "Send your token as `Authorization: Bearer <token>` (COOKOUT_TOKEN).",
  status: 401,
};

const tokenRevoked: Refusal = {
  code: "token_revoked",
  message: "This token was revoked. Ask an admin for a new one.",
  status: 401,
};

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

const outsideCommandThread: Refusal = {
  code: "outside_command_thread",
  message: "A command token can only post replies in its call's thread.",
  status: 403,
};

const CommandThread = Context.Reference<Option.Option<MessageId>>("cookout/identities/CommandThread", {
  defaultValue: Option.none,
});

interface RequestTarget {
  readonly method: string;
  readonly url: string;
}

function requireCommandRoute({ method, url }: RequestTarget): Effect.Effect<void, Refusal> {
  const [path] = Str.split("?")(url);
  if (method === "POST" && path === messagesPath) {
    return Effect.void;
  }
  return Effect.fail(outsideCommandThread);
}

interface Principal {
  readonly identity: Identity;
  readonly commandThread: Option.Option<MessageId>;
}

interface Credentials {
  readonly authorization: string | undefined;
  readonly sessionCookie: string | undefined;
}

function bearerToken(authorization: string): Effect.Effect<Token, Refusal> {
  const sent = bearer.exec(authorization)?.[1];
  return sent === undefined ? Effect.fail(tokenMissing) : Effect.succeed(token(sent));
}

function sentToken({ authorization, sessionCookie }: Credentials): Effect.Effect<Token, Refusal> {
  if (authorization !== undefined) {
    return bearerToken(authorization);
  }
  if (sessionCookie === undefined || sessionCookie === "") {
    return Effect.fail(tokenMissing);
  }
  return Effect.succeed(token(sessionCookie));
}

interface CarriesCredentials {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly cookies: Readonly<Record<string, string | undefined>>;
}

function credentialsOf({ cookies, headers }: CarriesCredentials): Credentials {
  return { authorization: headers["authorization"], sessionCookie: cookies[sessionCookieName] };
}

function commandTokenPrincipal(grant: CommandTokenGrant | undefined): Effect.Effect<Principal, Refusal> {
  return Effect.gen(function* checkCommandToken() {
    if (Predicate.isUndefined(grant)) {
      return yield* Effect.fail(tokenUnknown);
    }
    const now = yield* DateTime.now;
    if (DateTime.isGreaterThanOrEqualTo(now, DateTime.makeUnsafe(grant.expiresAt))) {
      return yield* Effect.fail(tokenExpired);
    }
    return { commandThread: Option.some(grant.threadId), identity: grant.handler };
  });
}

function principalOf(storage: Storage["Service"], hash: TokenHash) {
  return (found: TokenLookup): Effect.Effect<Principal, Refusal | StorageUnavailable> => {
    switch (found.status) {
      case "active": {
        return Effect.succeed({ commandThread: Option.none(), identity: found.identity });
      }
      case "revoked": {
        return Effect.fail(tokenRevoked);
      }
      case "unknown": {
        return Effect.flatMap(storage.findCommandToken(hash), commandTokenPrincipal);
      }
    }
  };
}

export const authenticate =
  (storage: Storage["Service"], secrets: Secrets["Service"]) =>
  (credentials: Credentials): Effect.Effect<Principal, Refusal | StorageUnavailable> =>
    sentToken(credentials).pipe(
      Effect.flatMap(secrets.hashToken),
      Effect.flatMap((hash) => Effect.flatMap(storage.findIdentityByTokenHash(hash), principalOf(storage, hash))),
    );

export class Caller extends Context.Service<Caller, Identity>()("@ai-hero/cookout/identities/lib/server/auth/Caller") {}

const adminOnly: Refusal = { code: "admin_only", message: "Only an admin identity can do this.", status: 403 };

export const requireAdmin: Effect.Effect<void, Refusal, Caller> = Effect.gen(function* () {
  const caller = yield* Caller;
  if (!caller.admin) {
    return yield* Effect.fail(adminOnly);
  }
});

export type IssuedToken = { readonly token: Token; readonly hash: TokenHash };

export const issueToken: Effect.Effect<IssuedToken, never, Secrets> = Effect.gen(function* () {
  const secrets = yield* Secrets;
  const token = yield* secrets.newToken;
  return { hash: yield* secrets.hashToken(token), token };
});

export {
  CommandThread,
  type Credentials,
  type Principal,
  credentialsOf,
  outsideCommandThread,
  requireCommandRoute,
  sentToken,
};
