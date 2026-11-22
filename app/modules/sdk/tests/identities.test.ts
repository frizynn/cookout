import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { TestClock } from "effect/testing";
import { identitiesPath } from "../../identities/index.ts";
import { TestCookout, testCookout } from "../../testing/server.ts";
import { CookoutError } from "../index.ts";

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

it.effect("an admin creates an identity with an owner and gets its token once", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    yield* TestClock.adjust("1 second");
    const created = yield* answer(() => cookout.client.createIdentity({ name: "auth-griller", owner: "matt" }));
    expect(created.identity).toEqual({
      name: "auth-griller",
      owner: "matt",
      admin: false,
      createdAt: "2026-01-01T00:00:01.000Z",
    });
    expect(created.token).not.toBe(cookout.adminToken);
    expect(yield* answer(() => cookout.clientFor(created.token).whoami())).toEqual({ identity: created.identity });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an admin creates an identity with no owner", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const created = yield* answer(() => cookout.client.createIdentity({ name: "company-bot" }));
    expect(created.identity).toEqual({ name: "company-bot", admin: false, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(created.identity).not.toHaveProperty("owner");
  }).pipe(Effect.provide(testCookout())),
);

it.effect("every identity gets a different random token of at least 256 bits", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const created = yield* Effect.forEach(["agent-0", "agent-1", "agent-2", "agent-3", "agent-4"], (name) =>
      answer(() => cookout.client.createIdentity({ name })),
    );
    const tokens = [cookout.adminToken, ...created.map(({ token }) => token)];
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const token of tokens) {
      const random = token.replace(/^cookout_/u, "");
      expect(random).toMatch(/^[A-Za-z0-9_-]+$/u);
      expect(random.length * 6).toBeGreaterThanOrEqual(256);
    }
  }).pipe(Effect.provide(testCookout({ secrets: "live" }))),
);

it.effect("a name already in use is refused with 409", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    yield* answer(() => cookout.client.createIdentity({ name: "twin" }));
    const error = yield* refusal(() => cookout.client.createIdentity({ name: "twin", owner: "matt" }));
    expect(error).toMatchObject({ status: 409, code: "identity_exists" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a name that breaks the naming rule is refused with 400", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    for (const name of ["", "Auth", "auth_griller", "auth griller", "@auth", "x".repeat(65)]) {
      const error = yield* refusal(() => cookout.client.createIdentity({ name }));
      expect(error).toMatchObject({
        status: 400,
        code: "invalid_request",
        details: [{ path: ["name"], message: "Use 1-64 lowercase letters, digits or '-'." }],
      });
    }
    const owner = yield* refusal(() => cookout.client.createIdentity({ name: "agent", owner: "x".repeat(101) }));
    expect(owner).toMatchObject({
      status: 400,
      code: "invalid_request",
      details: [{ path: ["owner"], message: "Use 1-100 characters." }],
    });
    for (const name of ["auth-griller", "a", "agent-7", "x".repeat(64)]) {
      expect((yield* answer(() => cookout.client.createIdentity({ name }))).identity.name).toBe(name);
    }
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a body that isn't JSON is refused with 400", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const response = yield* HttpClientRequest.post(`${cookout.url}${identitiesPath}`).pipe(
      HttpClientRequest.bearerToken(cookout.adminToken),
      HttpClientRequest.bodyText("{nope", "application/json"),
      HttpClient.execute,
    );
    expect(response.status).toBe(400);
    expect(yield* response.json).toMatchObject({ error: { code: "invalid_json" } });
  }).pipe(Effect.provide([testCookout(), FetchHttpClient.layer])),
);

it.effect("any identity lists every identity and its owner, sorted by name", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("zed-agent", { owner: "matt" });
    yield* cookout.createIdentity("bot");
    const { identities } = yield* answer(() => agent.client.listIdentities());
    expect(identities.map((identity) => [identity.name, identity.owner])).toEqual([
      ["admin", undefined],
      ["bot", undefined],
      ["zed-agent", "matt"],
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("rotating a token issues a new one and the old one gets 401 at once", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("leaky");
    const rotated = yield* answer(() => cookout.client.rotateToken("leaky"));
    expect(rotated.identity).toEqual(agent.identity);
    expect(rotated.token).not.toBe(agent.token);
    expect(yield* refusal(() => agent.client.whoami())).toMatchObject({ status: 401, code: "token_revoked" });
    expect(yield* answer(() => cookout.clientFor(rotated.token).whoami())).toEqual({ identity: agent.identity });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a path segment that isn't valid percent-encoding is 400 invalid_path on the identity routes", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const attempts = [
      HttpClientRequest.make("DELETE")(`${cookout.url}${identitiesPath}/%E0`),
      HttpClientRequest.post(`${cookout.url}${identitiesPath}/%E0/token`),
    ];
    for (const attempt of attempts) {
      const response = yield* HttpClient.execute(HttpClientRequest.bearerToken(attempt, cookout.adminToken));
      expect(response.status).toBe(400);
      expect(yield* response.json).toMatchObject({ error: { code: "invalid_path" } });
    }
  }).pipe(Effect.provide([testCookout(), FetchHttpClient.layer])),
);

it.effect("rotating the token of a missing identity is a 404", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const error = yield* refusal(() => cookout.client.rotateToken("nobody"));
    expect(error).toMatchObject({ status: 404, code: "identity_not_found" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("deleting an identity removes it and its token stops working", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("e2e-run-1", { owner: "matt" });
    expect(yield* answer(() => cookout.client.deleteIdentity("e2e-run-1"))).toEqual({ identity: agent.identity });
    const { identities } = yield* answer(() => cookout.client.listIdentities());
    expect(identities.map((identity) => identity.name)).toEqual(["admin"]);
    expect(yield* refusal(() => agent.client.whoami())).toMatchObject({ status: 401, code: "token_revoked" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("deleting the last admin is refused with 409 last_admin", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("agent");
    const error = yield* refusal(() => cookout.client.deleteIdentity("admin"));
    expect(error).toMatchObject({ status: 409, code: "last_admin" });
    expect((yield* answer(() => cookout.client.whoami())).identity).toMatchObject({ name: "admin", admin: true });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an admin can delete itself while another admin remains", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const second = yield* cookout.createIdentity("admin-2", { admin: true });
    const deleted = yield* answer(() => cookout.client.deleteIdentity("admin"));
    expect(deleted.identity).toMatchObject({ name: "admin", admin: true });
    expect(yield* refusal(() => cookout.client.whoami())).toMatchObject({ status: 401, code: "token_revoked" });
    const last = yield* refusal(() => second.client.deleteIdentity("admin-2"));
    expect(last).toMatchObject({ status: 409, code: "last_admin" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("deleting a missing identity is a 404", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const error = yield* refusal(() => cookout.client.deleteIdentity("nobody"));
    expect(error).toMatchObject({ status: 404, code: "identity_not_found" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a non-admin can't create, rotate or delete identities (403)", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    const attempts = [
      () => agent.client.createIdentity({ name: "sneaky" }),
      () => agent.client.rotateToken("admin"),
      () => agent.client.deleteIdentity("admin"),
    ];
    for (const attempt of attempts) {
      expect(yield* refusal(attempt)).toMatchObject({ status: 403, code: "admin_only" });
    }
    const { identities } = yield* answer(() => cookout.client.listIdentities());
    expect(identities.map((identity) => identity.name)).toEqual(["admin", "agent"]);
  }).pipe(Effect.provide(testCookout())),
);
