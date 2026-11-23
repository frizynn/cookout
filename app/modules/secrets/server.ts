/**
 * The one source of randomness and hashing: bearer tokens, what the store
 * keeps instead of a token, lease IDs and command secrets. The live Layer uses `node:crypto`;
 * tests count instead, with the Layer `testing` builds over this one.
 */
import { Context, Layer } from "effect";
import type { Token, TokenHash } from "../identities/index.ts";
import type { CommandSecret } from "../commands/index.ts";
import type { Effect } from "effect";
import type { LeaseId } from "../leases/index.ts";
import { liveSecrets } from "./lib/server/live.ts";

export interface SecretsService {
  /** A new bearer token: `cookout_` and at least 256 random bits. */
  readonly newToken: Effect.Effect<Token>;
  /** What the store keeps instead of the token. The same token always hashes the same. */
  readonly hashToken: (token: Token) => Effect.Effect<TokenHash>;
  /** A new lease ID: `lease_` and 128 random bits. */
  readonly newLeaseId: Effect.Effect<LeaseId>;
  /** A new command secret, for signing webhook deliveries: `hmac_` and 256 random bits. */
  readonly newCommandSecret: Effect.Effect<CommandSecret>;
  /** The SHA-256 of `text`, as hex: a file name that doesn't give away what it was made from. */
  readonly digest: (text: string) => Effect.Effect<string>;
}

export class Secrets extends Context.Service<Secrets, SecretsService>()("@ai-hero/cookout/secrets/server/Secrets") {}

/** Secrets from `node:crypto`, for the running cookout. */
export const secretsLive: Layer.Layer<Secrets> = Layer.succeed(Secrets, liveSecrets);
