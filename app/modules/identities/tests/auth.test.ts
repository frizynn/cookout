import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { request } from "../../http/client.ts";
import { CookoutError, createCookoutClient } from "../../sdk/index.ts";
import { TestCookout, testCookout } from "../../testing/server.ts";
import { whoamiPath } from "../index.ts";

const answer = <A>(call: () => Promise<A>) => Effect.promise(call);

const refusal = (call: () => Promise<unknown>) =>
  Effect.promise(() =>
    call().then(
      () => expect.unreachable("The call should have been refused."),
      (error: unknown) => error,
    ),
  ).pipe(
    Effect.map((error) => {
      expect(error).toBeInstanceOf(CookoutError);
      return error;
    }),
  );

it.effect("the first boot makes an admin identity with a working token", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    expect(cookout.adminToken).toMatch(/^cookout_/u);
    expect(yield* answer(() => cookout.client.whoami())).toEqual({
      identity: { name: "admin", admin: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("whoami shows a non-admin identity as not admin", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent", { owner: "matt" });
    expect(yield* answer(() => agent.client.whoami())).toEqual({ identity: agent.identity });
    expect(agent.identity.admin).toBe(false);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a request with no token gets 401 token_missing", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const error = yield* refusal(() => cookout.clientFor(undefined).whoami());
    expect(error).toMatchObject({ status: 401, code: "token_missing" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a header that isn't a bearer token gets 401 token_missing", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const response = yield* answer(() =>
      request({
        baseUrl: cookout.url,
        method: "GET",
        path: whoamiPath,
        headers: { authorization: `Basic ${cookout.adminToken}` },
      }),
    );
    expect(response.status).toBe(401);
    expect(response.json).toMatchObject({ error: { code: "token_missing" } });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a token that was never issued gets 401 token_unknown", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const error = yield* refusal(() => cookout.clientFor(`cookout_${"x".repeat(43)}`).whoami());
    expect(error).toMatchObject({ status: 401, code: "token_unknown" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a server on a store that already has identities makes no new admin", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const second = yield* cookout.startSecondServer;
    expect(second.adminToken).toBeUndefined();
    const admin = yield* answer(() =>
      createCookoutClient({ url: second.url, token: cookout.adminToken, env: {} }).whoami(),
    );
    expect(admin.identity).toMatchObject({ name: "admin", admin: true });
  }).pipe(Effect.provide(testCookout())),
);
