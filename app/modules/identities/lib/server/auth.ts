import { Effect } from "effect";
import type { Refusal } from "../../../http/index.ts";
import type { Secrets } from "../../../secrets/server.ts";
import type { Storage, StorageUnavailable, TokenLookup } from "../../../storage/server.ts";
import type { Identity, Token } from "../../index.ts";
import { token } from "../../index.ts";

const bearer = /^Bearer +(\S+)\s*$/iu;

const tokenMissing: Refusal = {
  status: 401,
  code: "token_missing",
  message: "Send your token as `Authorization: Bearer <token>` (COOKOUT_TOKEN).",
};

const tokenRevoked: Refusal = {
  status: 401,
  code: "token_revoked",
  message: "This token was revoked. Ask an admin for a new one.",
};

const tokenUnknown: Refusal = {
  status: 401,
  code: "token_unknown",
  message: "This token is not known to this cookout.",
};

const bearerToken = (authorization: string | undefined): Effect.Effect<Token, Refusal> => {
  const sent = authorization === undefined ? undefined : bearer.exec(authorization)?.[1];
  return sent === undefined ? Effect.fail(tokenMissing) : Effect.succeed(token(sent));
};

const identityOf = (found: TokenLookup): Effect.Effect<Identity, Refusal> => {
  switch (found.status) {
    case "active":
      return Effect.succeed(found.identity);
    case "revoked":
      return Effect.fail(tokenRevoked);
    case "unknown":
      return Effect.fail(tokenUnknown);
  }
};

export const authenticate =
  (storage: Storage["Service"], secrets: Secrets["Service"]) =>
  (authorization: string | undefined): Effect.Effect<Identity, Refusal | StorageUnavailable> =>
    bearerToken(authorization).pipe(
      Effect.flatMap(secrets.hashToken),
      Effect.flatMap(storage.findIdentityByTokenHash),
      Effect.flatMap(identityOf),
    );
