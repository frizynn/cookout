import { createHash, randomBytes } from "node:crypto";
import { Effect } from "effect";

export const liveSecrets = {
  newToken: Effect.sync(() => `cookout_${randomBytes(32).toString("base64url")}`),
  hashToken: (token: string) => Effect.sync(() => createHash("sha256").update(token).digest("hex")),
  newLeaseId: Effect.sync(() => `lease_${randomBytes(16).toString("base64url")}`),
};
