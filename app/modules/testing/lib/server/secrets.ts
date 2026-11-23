import { Effect, Layer, Option, Ref } from "effect";
import { Secrets, secretsLive } from "../../../secrets/server.ts";
import { token, tokenHash } from "../../../identities/index.ts";
import type { CommandSecret } from "../../../commands/index.ts";
import type { LeaseId } from "../../../leases/index.ts";
import type { SecretsService } from "../../../secrets/server.ts";
import type { Token } from "../../../identities/index.ts";
import { isCommandSecret } from "../../../commands/index.ts";
import { isLeaseId } from "../../../leases/index.ts";

type SecretsKind = "live" | "test";

const NONE_YET = 0;
const STEP = 1;

function leaseId(value: string): LeaseId {
  return Option.getOrThrow(Option.liftPredicate(value, isLeaseId));
}

function commandSecret(value: string): CommandSecret {
  return Option.getOrThrow(Option.liftPredicate(value, isCommandSecret));
}

function countingSecrets(live: SecretsService): Effect.Effect<SecretsService> {
  return Effect.gen(function* makeCountingSecrets() {
    const counter = yield* Ref.make(NONE_YET);
    function next(prefix: string): Effect.Effect<string> {
      return Effect.map(
        Ref.updateAndGet(counter, (count) => count + STEP),
        (count) => `${prefix}${String(count)}`,
      );
    }
    return {
      digest: live.digest,
      hashToken: (issued: Token) => Effect.succeed(tokenHash(`hash:${issued}`)),
      newCommandSecret: Effect.map(next("hmac_test_"), commandSecret),
      newLeaseId: Effect.map(next("lease_test_"), leaseId),
      newToken: Effect.map(next("cookout_test_"), token),
    };
  });
}

const secretsTest: Layer.Layer<Secrets> = Layer.effect(Secrets, Effect.flatMap(Secrets, countingSecrets)).pipe(
  Layer.provide(secretsLive),
);

function secretsOf(kind: SecretsKind): Layer.Layer<Secrets> {
  if (kind === "live") {
    return secretsLive;
  }
  return secretsTest;
}

export { leaseId, secretsOf, secretsTest };
