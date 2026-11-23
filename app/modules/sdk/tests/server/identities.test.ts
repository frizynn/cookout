import { Array as Arr, Effect, String as Str, pipe } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import { identitiesPath } from "../../../identities/index.ts";

const BAD_REQUEST = 400;
const MIN_TOKEN_BITS = 256;
const BITS_PER_CHARACTER = 6;
const FIRE = "🔥";
const MOST_FIRES = 50;
const TOO_MANY_FIRES = 51;
const LONGEST = 64;
const TOO_LONG = 65;
const LONGEST_OWNER = 100;
const TOO_LONG_OWNER = 101;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const BAD_NAMES = ["", "Auth", "auth_griller", "auth griller", "@auth", Str.repeat(TOO_LONG)("x")];
const BOOT = "2026-01-01T00:00:00.000Z";
const nameRefused = {
  code: "invalid_request",
  details: [{ message: "Use 1-64 lowercase letters, digits or '-'.", path: ["name"] }],
  status: BAD_REQUEST,
};
const ownerRefused = {
  code: "invalid_request",
  details: [{ message: "Use 1-100 characters.", path: ["owner"] }],
  status: BAD_REQUEST,
};

it.effect("an admin creates an identity with an owner and gets its token once", () =>
  Effect.gen(function* createWithOwner() {
    const cookout = yield* TestCookout;
    yield* TestClock.adjust("1 second");
    const created = yield* answer(() =>
      cookout.client.createIdentity({ kind: "agent", name: "auth-griller", owner: "matt" }),
    );
    const whoami = yield* answer(cookout.clientFor(created.token).whoami);

    expect(created.identity).toStrictEqual({
      admin: false,
      createdAt: "2026-01-01T00:00:01.000Z",
      kind: "agent",
      name: "auth-griller",
      owner: "matt",
    });
    expect(created.token).not.toBe(cookout.adminToken);
    expect(whoami).toStrictEqual({ identity: created.identity });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an admin creates an identity with no owner", () =>
  Effect.gen(function* createWithoutOwner() {
    const cookout = yield* TestCookout;
    const created = yield* answer(() => cookout.client.createIdentity({ kind: "agent", name: "company-bot" }));

    expect(created.identity).toStrictEqual({ admin: false, createdAt: BOOT, kind: "agent", name: "company-bot" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("every identity gets a different random token of at least 256 bits", () =>
  Effect.gen(function* randomTokens() {
    const cookout = yield* TestCookout;
    const created = yield* pipe(
      ["agent-0", "agent-1", "agent-2", "agent-3", "agent-4"],
      Effect.forEach((name) => answer(() => cookout.client.createIdentity({ kind: "agent", name })), ONE_AT_A_TIME),
    );
    const tokens = [
      cookout.adminToken,
      ...pipe(
        created,
        Arr.map(({ token }) => token),
      ),
    ];
    const randomParts = pipe(tokens, Arr.map(Str.replace(/^cookout_/u, "")));
    const shortest = Math.min(...pipe(randomParts, Arr.map(Str.length)));

    expect(new Set(tokens).size).toBe(tokens.length);
    expect(Arr.join(randomParts, "")).toMatch(/^[\w-]+$/u);
    expect(shortest * BITS_PER_CHARACTER).toBeGreaterThanOrEqual(MIN_TOKEN_BITS);
  }).pipe(Effect.provide(testCookout({ secrets: "live" }))),
);

it.effect("a name already in use is refused with 409", () =>
  Effect.gen(function* nameInUse() {
    const cookout = yield* TestCookout;
    yield* answer(() => cookout.client.createIdentity({ kind: "agent", name: "twin" }));
    const error = yield* refusal(() => cookout.client.createIdentity({ kind: "agent", name: "twin", owner: "matt" }));

    expect(error).toMatchObject({ code: "identity_exists", status: 409 });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("identity names are 1-64 lowercase letters, digits or '-'", () =>
  Effect.gen(function* identityNameRule() {
    const cookout = yield* TestCookout;
    const good = ["auth-griller", "a", "agent-7", Str.repeat(LONGEST)("x")];
    const created = yield* pipe(
      good,
      Effect.forEach((name) => answer(() => cookout.client.createIdentity({ kind: "agent", name })), ONE_AT_A_TIME),
    );

    expect(created).toMatchObject(
      pipe(
        good,
        Arr.map((name) => ({ identity: { name } })),
      ),
    );
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a name that breaks the naming rule is refused with 400", () =>
  Effect.gen(function* nameRuleRefusal() {
    const cookout = yield* TestCookout;
    const refused = yield* pipe(
      BAD_NAMES,
      Effect.forEach((name) => refusal(() => cookout.client.createIdentity({ kind: "agent", name })), ONE_AT_A_TIME),
    );
    const { identities } = yield* answer(() => cookout.client.listIdentities());

    expect(refused).toMatchObject(
      pipe(
        BAD_NAMES,
        Arr.map(() => ({ code: "invalid_request", status: BAD_REQUEST })),
      ),
    );
    expect(Arr.map(identities, ({ name }) => name)).toStrictEqual(["admin"]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a refused identity says, for each field, which rule it broke", () =>
  Effect.gen(function* schemaErrors() {
    const cookout = yield* TestCookout;
    const name = yield* refusal(() => cookout.client.createIdentity({ kind: "agent", name: "Auth" }));
    const owner = yield* refusal(() =>
      cookout.client.createIdentity({ kind: "agent", name: "agent", owner: Str.repeat(TOO_LONG_OWNER)("x") }),
    );

    expect([name, owner]).toMatchObject([nameRefused, ownerRefused]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an owner is 1-100 characters", () =>
  Effect.gen(function* ownerRule() {
    const cookout = yield* TestCookout;
    const good = ["m", "matt", Str.repeat(LONGEST_OWNER)("x"), Str.repeat(MOST_FIRES)(FIRE)];
    const bad = ["", Str.repeat(TOO_LONG_OWNER)("x"), Str.repeat(TOO_MANY_FIRES)(FIRE)];
    const created = yield* pipe(
      good,
      Effect.forEach(
        (owner, index) =>
          answer(() => cookout.client.createIdentity({ kind: "agent", name: `owned-${String(index)}`, owner })),
        ONE_AT_A_TIME,
      ),
    );
    const refused = yield* pipe(
      bad,
      Effect.forEach(
        (owner) => refusal(() => cookout.client.createIdentity({ kind: "agent", name: "agent", owner })),
        ONE_AT_A_TIME,
      ),
    );

    expect(created).toMatchObject(
      pipe(
        good,
        Arr.map((owner) => ({ identity: { owner } })),
      ),
    );
    expect(refused).toMatchObject(
      pipe(
        bad,
        Arr.map(() => ownerRefused),
      ),
    );
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a body that isn't JSON is refused with 400", () =>
  Effect.gen(function* notJson() {
    const cookout = yield* TestCookout;
    const response = yield* HttpClientRequest.post(`${cookout.url}${identitiesPath}`).pipe(
      HttpClientRequest.setHeader("authorization", `Bearer ${cookout.adminToken}`),
      HttpClientRequest.bodyText("{nope", "application/json"),
      HttpClient.execute,
    );
    const body = yield* response.json;

    expect(response.status).toBe(BAD_REQUEST);
    expect(body).toMatchObject({ error: { code: "invalid_json" } });
  }).pipe(Effect.provide([testCookout(), FetchHttpClient.layer])),
);

it.effect("any identity lists every identity with its kind and owner, sorted by name", () =>
  Effect.gen(function* listIdentities() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("zed-agent", { owner: "matt" });
    yield* cookout.createIdentity("bot");
    yield* cookout.createIdentity("matt", { kind: "human" });
    const { identities } = yield* answer(agent.client.listIdentities);

    expect(identities).toStrictEqual([
      { admin: true, createdAt: BOOT, kind: "human", name: "admin" },
      { admin: false, createdAt: BOOT, kind: "agent", name: "bot" },
      { admin: false, createdAt: BOOT, kind: "human", name: "matt" },
      { admin: false, createdAt: BOOT, kind: "agent", name: "zed-agent", owner: "matt" },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("rotating a token issues a new one and the old one gets 401 at once", () =>
  Effect.gen(function* rotateToken() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("leaky");
    const rotated = yield* answer(() => cookout.client.rotateToken("leaky"));
    const oldToken = yield* refusal(agent.client.whoami);
    const newToken = yield* answer(cookout.clientFor(rotated.token).whoami);

    expect(rotated.identity).toStrictEqual(agent.identity);
    expect(rotated.token).not.toBe(agent.token);
    expect(oldToken).toMatchObject({ code: "token_revoked", status: 401 });
    expect(newToken).toStrictEqual({ identity: agent.identity });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("rotating the token of a missing identity is a 404", () =>
  Effect.gen(function* rotateMissing() {
    const cookout = yield* TestCookout;
    const error = yield* refusal(() => cookout.client.rotateToken("nobody"));
    const badName = yield* refusal(() => cookout.client.rotateToken("Not A Name"));

    expect(error).toMatchObject({ code: "identity_not_found", status: 404 });
    expect(badName).toMatchObject({ code: "identity_not_found", status: 404 });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("deleting an identity removes it and its token stops working", () =>
  Effect.gen(function* deleteIdentity() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("e2e-run-1", { owner: "matt" });
    const deleted = yield* answer(() => cookout.client.deleteIdentity("e2e-run-1"));
    const listed = yield* answer(cookout.client.listIdentities);
    const error = yield* refusal(agent.client.whoami);

    expect(deleted).toStrictEqual({ identity: agent.identity });
    expect(listed).toStrictEqual({ identities: [{ admin: true, createdAt: BOOT, kind: "human", name: "admin" }] });
    expect(error).toMatchObject({ code: "token_revoked", status: 401 });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("deleting the last admin is refused with 409 last_admin", () =>
  Effect.gen(function* lastAdmin() {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("agent");
    const error = yield* refusal(() => cookout.client.deleteIdentity("admin"));
    const whoami = yield* answer(cookout.client.whoami);

    expect(error).toMatchObject({ code: "last_admin", status: 409 });
    expect(whoami.identity).toMatchObject({ admin: true, name: "admin" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an admin can delete itself while another admin remains", () =>
  Effect.gen(function* deleteSelf() {
    const cookout = yield* TestCookout;
    const second = yield* cookout.createIdentity("admin-2", { admin: true });
    const deleted = yield* answer(() => cookout.client.deleteIdentity("admin"));
    const revoked = yield* refusal(cookout.client.whoami);
    const last = yield* refusal(() => second.client.deleteIdentity("admin-2"));

    expect(deleted.identity).toMatchObject({ admin: true, name: "admin" });
    expect(revoked).toMatchObject({ code: "token_revoked", status: 401 });
    expect(last).toMatchObject({ code: "last_admin", status: 409 });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("deleting a missing identity is a 404", () =>
  Effect.gen(function* deleteMissing() {
    const cookout = yield* TestCookout;
    const error = yield* refusal(() => cookout.client.deleteIdentity("nobody"));

    expect(error).toMatchObject({ code: "identity_not_found", status: 404 });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a non-admin can't create, rotate or delete identities (403)", () =>
  Effect.gen(function* nonAdmin() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    const created = yield* refusal(() => agent.client.createIdentity({ kind: "agent", name: "sneaky" }));
    const rotated = yield* refusal(() => agent.client.rotateToken("admin"));
    const deleted = yield* refusal(() => agent.client.deleteIdentity("admin"));
    const listed = yield* answer(cookout.client.listIdentities);
    const adminOnly = { code: "admin_only", status: 403 };

    expect([created, rotated, deleted]).toMatchObject([adminOnly, adminOnly, adminOnly]);
    expect(listed.identities).toMatchObject([{ name: "admin" }, { name: "agent" }]);
  }).pipe(Effect.provide(testCookout())),
);
