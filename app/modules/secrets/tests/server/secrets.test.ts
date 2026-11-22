import { Secrets, secretsLive } from "../../server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

it.effect("a live lease ID is lease_ and 128 random bits", () =>
  Effect.gen(function* liveLeaseId() {
    const secrets = yield* Secrets;
    const leaseId = yield* secrets.newLeaseId;

    expect(leaseId).toMatch(/^lease_[\w-]{22}$/u);
  }).pipe(Effect.provide(secretsLive)),
);
