import { Array as Arr, Effect } from "effect";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

const HUMAN = { kind: "human" } as const;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
const notOwner = { code: "not_owner", status: FORBIDDEN };

function adaWithAgents(cookout: TestCookoutService): Effect.Effect<TestIdentity> {
  return Effect.gen(function* createAda() {
    const ada = yield* cookout.createIdentity("ada", HUMAN);
    yield* cookout.createIdentity("grace", HUMAN);
    yield* cookout.createIdentity("ada/helper", { owner: "ada" });
    yield* cookout.createIdentity("release-bot", { owner: "ada" });
    return ada;
  });
}

it.effect("deactivating an identity makes every token it holds fail, while its messages keep its name", () =>
  Effect.gen(function* deactivateKeepsHistory() {
    const cookout = yield* TestCookout;
    const bot = yield* cookout.createIdentity("auth-griller");
    yield* answer(() => bot.client.createChannel({ name: "grill" }));
    const { message } = yield* answer(() => bot.client.createMessage({ channel: "grill", text: "hello" }));
    const session = yield* answer(() => bot.client.join({ as: "auth-griller" }));
    const deactivated = yield* answer(() => cookout.client.deactivateIdentity("auth-griller"));
    const tokens = yield* Effect.all(
      [refusal(bot.client.whoami), refusal(cookout.clientFor(session.agentSessionToken).whoami)],
      ONE_AT_A_TIME,
    );
    const { messages } = yield* answer(() => cookout.client.listMessages("grill"));

    expect(deactivated).toStrictEqual({ agents: [], identity: { ...bot.identity, deactivated: true } });
    expect([tokens, Arr.map(messages, ({ author, id }) => [id, author.name])]).toMatchObject([
      [
        { code: "token_revoked", status: UNAUTHORIZED },
        { code: "agent_session_revoked", status: UNAUTHORIZED },
      ],
      [[message.id, "auth-griller"]],
    ]);
  }).pipe(Effect.provide(testCookout({ secrets: "live" }))),
);

it.effect("a deactivated name stays reserved: creating an identity with it is refused", () =>
  Effect.gen(function* nameReserved() {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("ada", HUMAN);
    yield* answer(() => cookout.client.deactivateIdentity("ada"));
    const refused = yield* refusal(() => cookout.client.createIdentity({ kind: "human", name: "ada" }));

    expect(refused).toMatchObject({ code: "identity_exists", status: CONFLICT });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("deactivating a human deactivates every agent they own, and no one else's", () =>
  Effect.gen(function* cascade() {
    const cookout = yield* TestCookout;
    yield* adaWithAgents(cookout);
    const kept = yield* cookout.createIdentity("grace/helper", { owner: "grace" });
    const deactivated = yield* answer(() => cookout.client.deactivateIdentity("ada"));
    const everyone = yield* answer(() => cookout.client.listIdentities({ include: "deactivated" }));
    const still = yield* answer(kept.client.whoami);

    expect(deactivated).toMatchObject({ agents: ["ada/helper", "release-bot"], identity: { deactivated: true } });
    expect(Arr.map(everyone.identities, ({ deactivated: off, name }) => [name, off === true])).toStrictEqual([
      ["ada", true],
      ["ada/helper", true],
      ["admin", false],
      ["grace", false],
      ["grace/helper", false],
      ["release-bot", true],
    ]);
    expect(still.identity).toStrictEqual(kept.identity);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a deactivated identity can't be mentioned, and the identity list hides it unless asked", () =>
  Effect.gen(function* hidden() {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("ada", HUMAN);
    yield* cookout.createIdentity("grace", HUMAN);
    yield* answer(() => cookout.client.deactivateIdentity("ada"));
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
    const posted = yield* answer(() => cookout.client.createMessage({ channel: "grill", text: "@ada and @grace" }));
    const listed = yield* answer(() => cookout.client.listIdentities());

    expect([posted.message.mentions, posted.unknownMentions]).toStrictEqual([["grace"], ["ada"]]);
    expect(Arr.map(listed.identities, ({ name }) => name)).toStrictEqual(["admin", "grace"]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("reactivating answers a fresh token while the old tokens stay dead", () =>
  Effect.gen(function* reactivate() {
    const cookout = yield* TestCookout;
    const ada = yield* cookout.createIdentity("ada", HUMAN);
    yield* answer(() => cookout.client.deactivateIdentity("ada"));
    const reactivated = yield* answer(() => cookout.client.reactivateIdentity("ada"));
    const old = yield* refusal(ada.client.whoami);
    const fresh = yield* answer(cookout.clientFor(reactivated.token).whoami);

    expect(reactivated.identity).toStrictEqual(ada.identity);
    expect(old).toMatchObject({ code: "token_revoked", status: UNAUTHORIZED });
    expect(fresh.identity).toStrictEqual(ada.identity);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent session token from before deactivation stays dead after reactivation", () =>
  Effect.gen(function* sessionStaysDead() {
    const cookout = yield* TestCookout;
    const bot = yield* cookout.createIdentity("auth-griller");
    const session = yield* answer(() => bot.client.join({ as: "auth-griller" }));
    yield* answer(() => cookout.client.deactivateIdentity("auth-griller"));
    yield* answer(() => cookout.client.reactivateIdentity("auth-griller"));
    const old = yield* refusal(cookout.clientFor(session.agentSessionToken).whoami);

    expect(old).toMatchObject({ code: "agent_session_revoked", status: UNAUTHORIZED });
  }).pipe(Effect.provide(testCookout({ secrets: "live" }))),
);

it.effect("reactivating an agent whose owner is deactivated is refused, and an active one is refused too", () =>
  Effect.gen(function* reactivateRefused() {
    const cookout = yield* TestCookout;
    yield* adaWithAgents(cookout);
    yield* answer(() => cookout.client.deactivateIdentity("ada"));
    const refused = yield* Effect.all(
      [
        refusal(() => cookout.client.reactivateIdentity("ada/helper")),
        refusal(() => cookout.client.reactivateIdentity("admin")),
        refusal(() => cookout.client.reactivateIdentity("nobody")),
      ],
      ONE_AT_A_TIME,
    );

    expect(refused).toMatchObject([
      { code: "owner_deactivated", details: { owner: "ada" }, status: CONFLICT },
      { code: "not_deactivated", status: CONFLICT },
      { code: "identity_not_found", status: NOT_FOUND },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an owner deactivates and reactivates their own agents", () =>
  Effect.gen(function* ownerRights() {
    const cookout = yield* TestCookout;
    const ada = yield* adaWithAgents(cookout);
    const own = yield* answer(() => ada.client.deactivateIdentity("ada/helper"));
    const back = yield* answer(() => ada.client.reactivateIdentity("ada/helper"));

    expect(own.identity).toMatchObject({ deactivated: true, name: "ada/helper" });
    expect(back.identity).toMatchObject({ name: "ada/helper" });
    expect(back.identity).not.toHaveProperty("deactivated");
  }).pipe(Effect.provide(testCookout())),
);

it.effect("nobody but an admin or the owner deactivates an agent, and only an admin reactivates a human (403)", () =>
  Effect.gen(function* othersRefused() {
    const cookout = yield* TestCookout;
    const ada = yield* adaWithAgents(cookout);
    const helper = yield* cookout.createIdentity("grace/helper", { owner: "grace" });
    const refused = yield* Effect.all(
      [
        refusal(() => ada.client.deactivateIdentity("grace/helper")),
        refusal(() => ada.client.deactivateIdentity("admin")),
        refusal(() => helper.client.deactivateIdentity("ada/helper")),
      ],
      ONE_AT_A_TIME,
    );
    yield* answer(() => cookout.client.deactivateIdentity("grace"));
    const human = yield* refusal(() => ada.client.reactivateIdentity("grace"));

    expect(refused).toMatchObject([notOwner, notOwner, notOwner]);
    expect(human).toMatchObject({ code: "admin_only", status: FORBIDDEN });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the last admin can't be deactivated, and a deactivated admin no longer counts", () =>
  Effect.gen(function* lastAdmin() {
    const cookout = yield* TestCookout;
    const second = yield* cookout.createIdentity("admin-2", { admin: true, kind: "human" });
    const missing = yield* refusal(() => second.client.deactivateIdentity("nobody"));
    const deactivated = yield* answer(() => second.client.deactivateIdentity("admin"));
    const last = yield* refusal(() => second.client.deactivateIdentity("admin-2"));
    const kept = yield* refusal(() => second.client.removeAdmin("admin-2"));

    expect(missing).toMatchObject({ code: "identity_not_found", status: NOT_FOUND });
    expect(deactivated.identity).toMatchObject({ admin: true, deactivated: true, name: "admin" });
    expect([last, kept]).toMatchObject([
      { code: "last_admin", status: CONFLICT },
      { code: "last_admin", status: CONFLICT },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("deactivating an identity twice answers it deactivated both times", () =>
  Effect.gen(function* twice() {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("auth-griller");
    const answers = yield* Effect.all(
      [
        answer(() => cookout.client.deactivateIdentity("auth-griller")),
        answer(() => cookout.client.deactivateIdentity("auth-griller")),
      ],
      ONE_AT_A_TIME,
    );

    expect(answers).toMatchObject([
      { identity: { deactivated: true, name: "auth-griller" } },
      { identity: { deactivated: true, name: "auth-griller" } },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a deactivated admin identity stays refused after a reboot sets its token from the setting again", () =>
  Effect.gen(function* rebootKeepsItOff() {
    const cookout = yield* TestCookout;
    const second = yield* cookout.createIdentity("admin-2", { admin: true, kind: "human" });
    yield* answer(() => second.client.deactivateIdentity("admin"));
    const restarted = yield* cookout.restart;
    const refused = yield* refusal(restarted.whoami);

    expect(refused).toMatchObject({ code: "token_revoked", status: UNAUTHORIZED });
  }).pipe(Effect.provide(testCookout({ storage: "sqlite" }))),
);
