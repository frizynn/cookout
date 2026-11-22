import { createHash, randomBytes } from "node:crypto";
import { Effect } from "effect";
import { type Token, token, tokenHash } from "../../../identities/index.ts";

export const liveSecrets = {
  newToken: Effect.sync(() => token(`cookout_${randomBytes(32).toString("base64url")}`)),
  hashToken: (issued: Token) => Effect.sync(() => tokenHash(createHash("sha256").update(issued).digest("hex"))),
  newLeaseId: Effect.sync(() => `lease_${randomBytes(16).toString("base64url")}`),
};
