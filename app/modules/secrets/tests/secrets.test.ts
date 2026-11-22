import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { Secrets, secretsLive, secretsTest } from "../server.ts";

it.effect("a live token is cookout_ and 256 random bits, and no two are the same", () =>
  Effect.gen(function* () {
    const secrets = yield* Secrets;
    const [first, second] = [yield* secrets.newToken, yield* secrets.newToken];
    expect(first).toMatch(/^cookout_[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  }).pipe(Effect.provide(secretsLive)),
);

it.effect("a token always hashes the same, and two tokens hash differently", () =>
  Effect.gen(function* () {
    const secrets = yield* Secrets;
    expect(yield* secrets.hashToken("cookout_a")).toBe(yield* secrets.hashToken("cookout_a"));
    expect(yield* secrets.hashToken("cookout_a")).not.toBe(yield* secrets.hashToken("cookout_b"));
  }).pipe(Effect.provide(secretsLive)),
);

it.effect("a live lease ID is lease_ and 128 random bits", () =>
  Effect.gen(function* () {
    const secrets = yield* Secrets;
    expect(yield* secrets.newLeaseId).toMatch(/^lease_[A-Za-z0-9_-]{22}$/);
  }).pipe(Effect.provide(secretsLive)),
);

it.effect("the test secrets count up from 1", () =>
  Effect.gen(function* () {
    const secrets = yield* Secrets;
    expect([yield* secrets.newToken, yield* secrets.newLeaseId]).toEqual(["cookout_test_1", "lease_test_2"]);
  }).pipe(Effect.provide(secretsTest)),
);
