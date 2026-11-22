import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestCookout, testCookout } from "../../testing/server.ts";
import { CookoutError, createCookoutClient } from "../index.ts";

it.effect("the SDK defaults its URL and token to COOKOUT_URL and COOKOUT_TOKEN", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const client = createCookoutClient({ env: { COOKOUT_URL: cookout.url, COOKOUT_TOKEN: cookout.adminToken } });
    expect((yield* Effect.promise(() => client.whoami())).identity.name).toBe("admin");
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an empty COOKOUT_TOKEN counts as no token", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const client = createCookoutClient({ env: { COOKOUT_URL: cookout.url, COOKOUT_TOKEN: "" } });
    const error = yield* Effect.promise(() => client.whoami().catch((caught: unknown) => caught));
    expect(error).toMatchObject({ status: 401, code: "token_missing" });
  }).pipe(Effect.provide(testCookout())),
);

it("the SDK refuses with url_missing when there is no URL", () => {
  for (const env of [{}, { COOKOUT_URL: "" }]) {
    let caught: unknown;
    try {
      createCookoutClient({ env });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CookoutError);
    expect(caught).toMatchObject({ status: 0, code: "url_missing" });
  }
});
