/**
 * The one source of randomness and hashing: bearer tokens, what the store
 * keeps instead of a token, and lease IDs. The live Layer uses `node:crypto`;
 * the test Layer counts, so tests see the same values on every run.
 */
import { Context, Effect, Layer, Ref } from "effect";
import { liveSecrets } from "./lib/server/live.ts";

export type SecretsService = {
  /** A new bearer token: `cookout_` and at least 256 random bits. */
  readonly newToken: Effect.Effect<string>;
  /** What the store keeps instead of the token. The same token always hashes the same. */
  readonly hashToken: (token: string) => Effect.Effect<string>;
  /** A new lease ID: `lease_` and 128 random bits. */
  readonly newLeaseId: Effect.Effect<string>;
};

export class Secrets extends Context.Service<Secrets, SecretsService>()("cookout/secrets/Secrets") {}

/** Secrets from `node:crypto`, for the running cookout. */
export const secretsLive: Layer.Layer<Secrets> = Layer.succeed(Secrets, liveSecrets);

/** Deterministic secrets for tests: `cookout_test_1`, `cookout_test_2`… and `lease_test_1`… */
export const secretsTest: Layer.Layer<Secrets> = Layer.effect(
  Secrets,
  Effect.map(Ref.make(0), (counter) => {
    const next = (prefix: string) => Ref.updateAndGet(counter, (n) => n + 1).pipe(Effect.map((n) => `${prefix}${n}`));
    return {
      newToken: next("cookout_test_"),
      hashToken: (token: string) => Effect.succeed(`hash:${token}`),
      newLeaseId: next("lease_test_"),
    };
  }),
);
