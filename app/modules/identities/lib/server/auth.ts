import { Context, Effect } from "effect";
import type { Identity, Token, TokenHash } from "../../index.ts";
import type { Storage, StorageUnavailable, TokenLookup } from "../../../storage/server.ts";
import { sessionCookieName, token } from "../../index.ts";
import type { Refusal } from "../../../http/index.ts";
import { Secrets } from "../../../secrets/server.ts";

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

const identityOf = (found: TokenLookup): Effect.Effect<Identity, Refusal> => {
  switch (found.status) {
    case "active": {
      return Effect.succeed(found.identity);
    }
    case "revoked": {
      return Effect.fail(tokenRevoked);
    }
    case "unknown": {
      return Effect.fail(tokenUnknown);
    }
  }
};

export const authenticate =
  (storage: Storage["Service"], secrets: Secrets["Service"]) =>
  (credentials: Credentials): Effect.Effect<Identity, Refusal | StorageUnavailable> =>
    sentToken(credentials).pipe(
      Effect.flatMap(secrets.hashToken),
      Effect.flatMap(storage.findIdentityByTokenHash),
      Effect.flatMap(identityOf),
    );

export class Caller extends Context.Service<Caller, Identity>()("cookout/identities/Caller") {}

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

export { type Credentials, credentialsOf, sentToken };
