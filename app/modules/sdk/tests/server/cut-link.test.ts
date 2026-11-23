import { Effect, Fiber } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { TestCookout, answer, cuttableRelay, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { relayCutPath, relayRestorePath } from "../../../http/index.ts";
import type { HealthResponse } from "../../index.ts";
import { TestClock } from "effect/testing";
import { createCookoutClient } from "../../index.ts";

const A_MOMENT = "50 millis";
const NO_CONTENT = 204;

function healthAskedAt(url: string): Effect.Effect<Fiber.Fiber<HealthResponse>> {
  return Effect.gen(function* askForHealth() {
    const client = createCookoutClient({ env: {}, url });
    const asking = yield* Effect.forkChild(answer(() => client.health()));
    yield* TestClock.withLive(Effect.sleep(A_MOMENT));
    return asking;
  });
}

it.effect("a watch through a cut link ends", () =>
  Effect.gen(function* watchThroughCut() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const relay = yield* cuttableRelay(cookout.url);
    const client = createCookoutClient({ env: {}, token: ann.token, url: relay.url });
    const events = yield* answer(() => client.watch());
    const reading = yield* Effect.forkChild(Effect.exit(answer(() => events[Symbol.asyncIterator]().next())));

    yield* relay.cut;
    const ended = yield* Fiber.join(reading);

    expect(ended).toMatchObject({ value: { done: true } });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a call through a cut link waits for the restore, then gets the cookout's answer", () =>
  Effect.gen(function* callThroughCut() {
    const cookout = yield* TestCookout;
    const relay = yield* cuttableRelay(cookout.url);
    yield* relay.cut;
    const asking = yield* healthAskedAt(relay.url);
    const held = asking.pollUnsafe();

    expect(held).toBeUndefined();

    yield* relay.restore;
    const health = yield* Fiber.join(asking);

    expect(health).toMatchObject({ status: "ok" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a POST to the link's cut and restore paths cuts and restores it, for a test in another process", () =>
  Effect.gen(function* controlOverHttp() {
    const cookout = yield* TestCookout;
    const relay = yield* cuttableRelay(cookout.url);
    const cut = yield* HttpClient.execute(HttpClientRequest.post(`${relay.url}${relayCutPath}`));
    const asking = yield* healthAskedAt(relay.url);
    const held = asking.pollUnsafe();

    expect(cut.status).toBe(NO_CONTENT);
    expect(held).toBeUndefined();

    yield* HttpClient.execute(HttpClientRequest.post(`${relay.url}${relayRestorePath}`));
    const health = yield* Fiber.join(asking);

    expect(health).toMatchObject({ status: "ok" });
  }).pipe(Effect.provide([testCookout(), FetchHttpClient.layer])),
);
