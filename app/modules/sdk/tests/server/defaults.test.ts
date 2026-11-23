import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import { expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { createCookoutClient } from "../../index.ts";

it.effect("the SDK defaults its URL and token to COOKOUT_URL and COOKOUT_TOKEN", () =>
  Effect.gen(function* envDefaults() {
    const cookout = yield* TestCookout;
    const client = createCookoutClient({ env: { COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url } });
    const whoami = yield* answer(client.whoami);

    expect(whoami.identity).toMatchObject({ name: "admin" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("in a browser, with no process, the SDK reads no environment and uses the URL and token it is given", () =>
  Effect.gen(function* noProcess() {
    const cookout = yield* TestCookout;
    const client = yield* Effect.acquireUseRelease(
      Effect.sync(() => {
        vi.stubGlobal("process", {});
        Reflect.deleteProperty(globalThis, "process");
      }),
      () => Effect.sync(() => createCookoutClient({ token: cookout.adminToken, url: cookout.url })),
      () => Effect.sync(() => vi.unstubAllGlobals()),
    );
    const whoami = yield* answer(client.whoami);

    expect(whoami.identity).toMatchObject({ name: "admin" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an empty COOKOUT_TOKEN counts as no token", () =>
  Effect.gen(function* emptyToken() {
    const cookout = yield* TestCookout;
    const client = createCookoutClient({ env: { COOKOUT_TOKEN: "", COOKOUT_URL: cookout.url } });
    const error = yield* refusal(client.whoami);

    expect(error).toMatchObject({ code: "token_missing", status: 401 });
  }).pipe(Effect.provide(testCookout())),
);
