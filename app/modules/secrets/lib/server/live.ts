import type { CallId, CommandSecret } from "../../../commands/index.ts";
import { Effect, Option } from "effect";
import type { Token, TokenHash } from "../../../identities/index.ts";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { isCallId, isCommandSecret } from "../../../commands/index.ts";
import { token, tokenHash } from "../../../identities/index.ts";
import type { LeaseId } from "../../../leases/index.ts";
import { isLeaseId } from "../../../leases/index.ts";

interface LiveSecrets {
  readonly digest: (text: string) => Effect.Effect<string>;
  readonly newCallId: Effect.Effect<CallId>;
  readonly newCommandSecret: Effect.Effect<CommandSecret>;
  readonly newCommandToken: Effect.Effect<Token>;
  readonly hashToken: (issued: Token) => Effect.Effect<TokenHash>;
  readonly newLeaseId: Effect.Effect<LeaseId>;
  readonly newToken: Effect.Effect<Token>;
  readonly signature: (secret: CommandSecret, body: string) => Effect.Effect<string>;
}

const TOKEN_BYTES = 32;
const LEASE_ID_BYTES = 16;
const SECRET_BYTES = 32;
const CALL_ID_BYTES = 16;

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function asLeaseId(value: string): LeaseId {
  return Option.getOrThrow(Option.liftPredicate(value, isLeaseId));
}

function asCallId(value: string): CallId {
  return Option.getOrThrow(Option.liftPredicate(value, isCallId));
}

function newToken(): Token {
  return token(`cookout_${randomBytes(TOKEN_BYTES).toString("base64url")}`);
}

function asCommandSecret(value: string): CommandSecret {
  return Option.getOrThrow(Option.liftPredicate(value, isCommandSecret));
}

const liveSecrets: LiveSecrets = {
  digest: (text) => Effect.sync(() => sha256(text)),
  hashToken: (issued) => Effect.sync(() => tokenHash(sha256(issued))),
  newCallId: Effect.sync(() => asCallId(`call_${randomBytes(CALL_ID_BYTES).toString("base64url")}`)),
  newCommandSecret: Effect.sync(() => asCommandSecret(`hmac_${randomBytes(SECRET_BYTES).toString("base64url")}`)),
  newCommandToken: Effect.sync(newToken),
  newLeaseId: Effect.sync(() => asLeaseId(`lease_${randomBytes(LEASE_ID_BYTES).toString("base64url")}`)),
  newToken: Effect.sync(newToken),
  signature: (secret, body) => Effect.sync(() => createHmac("sha256", secret).update(body).digest("hex")),
};

export { liveSecrets };
