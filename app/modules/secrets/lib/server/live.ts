import type { Token, TokenHash } from "../../../identities/index.ts";
import { token, tokenHash } from "../../../identities/index.ts";
import { Effect, Option } from "effect";
import { createHash, randomBytes } from "node:crypto";
import type { LeaseId } from "../../../leases/index.ts";
import { isLeaseId } from "../../../leases/index.ts";

interface LiveSecrets {
  readonly digest: (text: string) => Effect.Effect<string>;
  readonly hashToken: (issued: Token) => Effect.Effect<TokenHash>;
  readonly newLeaseId: Effect.Effect<LeaseId>;
  readonly newToken: Effect.Effect<Token>;
}

const TOKEN_BYTES = 32;
const LEASE_ID_BYTES = 16;

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function asLeaseId(value: string): LeaseId {
  return Option.getOrThrow(Option.liftPredicate(value, isLeaseId));
}

const liveSecrets: LiveSecrets = {
  digest: (text) => Effect.sync(() => sha256(text)),
  hashToken: (issued) => Effect.sync(() => tokenHash(sha256(issued))),
  newLeaseId: Effect.sync(() => asLeaseId(`lease_${randomBytes(LEASE_ID_BYTES).toString("base64url")}`)),
  newToken: Effect.sync(() => token(`cookout_${randomBytes(TOKEN_BYTES).toString("base64url")}`)),
};

export { asLeaseId, liveSecrets };
