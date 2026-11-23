import { Effect, String as Str } from "effect";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import { healthPath } from "../../../http/index.ts";
import { request } from "../../../http/client.ts";

const OK = 200;
const NOT_FOUND = 404;
const LONG = 5000;
const ECHOED = 100;

it.effect("a server on port 0 answers the health check through the SDK", () =>
  Effect.gen(function* healthOnAFreePort() {
    const cookout = yield* TestCookout;
    const health = yield* answer(cookout.client.health);

    expect(new URL(cookout.url).port).not.toBe("0");
    expect(health).toStrictEqual({ status: "ok", time: "2026-01-01T00:00:00.000Z" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the health check reports the server's clock", () =>
  Effect.gen(function* healthReportsTheClock() {
    const cookout = yield* TestCookout;
    yield* TestClock.adjust("90 seconds");
    const health = yield* answer(cookout.client.health);

    expect(health.time).toBe("2026-01-01T00:01:30.000Z");
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the health check needs no token", () =>
  Effect.gen(function* healthNeedsNoToken() {
    const cookout = yield* TestCookout;
    const response = yield* answer(() => request({ baseUrl: cookout.url, method: "GET", path: healthPath }));

    expect(response.status).toBe(OK);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the health check fails with 503 when storage is unusable", () =>
  Effect.gen(function* healthWithUnusableStorage() {
    const cookout = yield* TestCookout;
    const error = yield* refusal(cookout.client.health);

    expect(error).toMatchObject({ code: "storage_unavailable", status: 503 });
  }).pipe(Effect.provide(testCookout({ storage: "unusable" }))),
);

it.effect("a refusal echoes at most 100 characters of the path or name it was sent", () =>
  Effect.gen(function* echoesAreCut() {
    const cookout = yield* TestCookout;
    const long = Str.repeat(LONG)("a");
    const route = yield* answer(() => request({ baseUrl: cookout.url, method: "GET", path: `/v1/${long}` }));
    const channel = yield* refusal(() => cookout.client.getChannel(long));
    const identity = yield* refusal(() => cookout.client.deleteIdentity(long));
    const messages = [route.json, { error: channel }, { error: identity }];

    expect(messages).toMatchObject([
      { error: { code: "not_found", message: `No route for GET /v1/${Str.repeat(ECHOED - "/v1/".length)("a")}….` } },
      { error: { code: "channel_not_found", message: `There is no channel named ${Str.repeat(ECHOED)("a")}….` } },
      { error: { code: "identity_not_found", message: `There is no identity named ${Str.repeat(ECHOED)("a")}….` } },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an unknown route is a 404 in the error shape", () =>
  Effect.gen(function* unknownRoute() {
    const cookout = yield* TestCookout;
    const response = yield* answer(() => request({ baseUrl: cookout.url, method: "GET", path: "/v1/no-such-route" }));

    expect(response.status).toBe(NOT_FOUND);
    expect(response.json).toMatchObject({ error: { code: "not_found" } });
  }).pipe(Effect.provide(testCookout())),
);
