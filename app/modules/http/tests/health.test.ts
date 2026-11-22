import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { CookoutError } from "../../sdk/index.ts";
import { TestCookout, testCookout } from "../../testing/server.ts";
import { request } from "../client.ts";
import { healthPath } from "../index.ts";

it.effect("a server on port 0 answers the health check through the SDK", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    expect(new URL(cookout.url).port).not.toBe("0");
    expect(yield* Effect.promise(() => cookout.client.health())).toEqual({
      status: "ok",
      time: "2026-01-01T00:00:00.000Z",
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the health check reports the server's clock", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    yield* TestClock.adjust("90 seconds");
    expect((yield* Effect.promise(() => cookout.client.health())).time).toBe("2026-01-01T00:01:30.000Z");
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the health check needs no token", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const response = yield* Effect.promise(() => request({ baseUrl: cookout.url, method: "GET", path: healthPath }));
    expect(response.status).toBe(200);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the health check fails with 503 when storage is unusable", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const error = yield* Effect.promise(() => cookout.client.health().catch((caught: unknown) => caught));
    expect(error).toBeInstanceOf(CookoutError);
    expect(error).toMatchObject({ status: 503, code: "storage_unavailable" });
  }).pipe(Effect.provide(testCookout({ storage: "unusable" }))),
);

it.effect("an unknown route is a 404 in the error shape", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const response = yield* Effect.promise(() =>
      request({ baseUrl: cookout.url, method: "GET", path: "/v1/no-such-route" }),
    );
    expect(response.status).toBe(404);
    expect(response.json).toMatchObject({ error: { code: "not_found" } });
  }).pipe(Effect.provide(testCookout())),
);
