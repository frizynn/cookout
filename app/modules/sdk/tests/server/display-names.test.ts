import { Array as Arr, Effect, Option, String as Str } from "effect";
import type { CookoutClient, CookoutEvent, EventStream, Identity } from "../../index.ts";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";

const BAD_REQUEST = 400;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const LONGEST = 80;

function displayNameOf(identities: readonly Identity[], name: string): string | null {
  return Arr.findFirst(identities, (identity) => identity.name === name).pipe(
    Option.flatMapNullishOr(({ displayName }) => displayName),
    Option.getOrNull,
  );
}

function watchingAllChannels(client: CookoutClient): Effect.Effect<AsyncIterator<CookoutEvent>, never, Scope.Scope> {
  return Effect.map(
    Effect.acquireRelease(
      answer(() => client.watch({ allChannels: true })),
      (events: EventStream) => answer(() => events.close()),
    ),
    (events) => events[Symbol.asyncIterator](),
  );
}

it.effect("a human sets their own display name, which shows wherever identities are answered", () =>
  Effect.gen(function* ownDisplayName() {
    const cookout = yield* TestCookout;
    const grace = yield* cookout.createIdentity("grace", { kind: "human" });
    const { identity } = yield* answer(() => grace.client.setDisplayName("grace", "  Grace Hopper "));
    const whoami = yield* answer(grace.client.whoami);
    const { identities } = yield* answer(cookout.client.listIdentities);

    expect(identity).toStrictEqual({ ...grace.identity, displayName: "Grace Hopper" });
    expect(whoami).toStrictEqual({ identity });
    expect(displayNameOf(identities, "grace")).toBe("Grace Hopper");
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a human sets the display name of an agent they own, and the agent sets its own", () =>
  Effect.gen(function* ownedAgent() {
    const cookout = yield* TestCookout;
    const ada = yield* cookout.createIdentity("ada", { kind: "human" });
    const bot = yield* cookout.createIdentity("release-bot", { owner: "ada" });
    const byOwner = yield* answer(() => ada.client.setDisplayName("release-bot", "Release bot"));
    const byItself = yield* answer(() => bot.client.setDisplayName("release-bot", "Shipper"));

    expect(byOwner.identity).toStrictEqual({ ...bot.identity, displayName: "Release bot" });
    expect(byItself.identity).toStrictEqual({ ...bot.identity, displayName: "Shipper" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("anyone else setting a display name is refused with 403 not_owner, and nothing changes", () =>
  Effect.gen(function* refusedCallers() {
    const cookout = yield* TestCookout;
    const grace = yield* cookout.createIdentity("grace", { kind: "human" });
    yield* cookout.createIdentity("ada", { kind: "human" });
    const bot = yield* cookout.createIdentity("release-bot", { owner: "ada" });
    const otherHuman = yield* refusal(() => grace.client.setDisplayName("release-bot", "Mine now"));
    const agentOnHuman = yield* refusal(() => bot.client.setDisplayName("ada", "Ada"));
    const { identities } = yield* answer(cookout.client.listIdentities);

    expect([otherHuman, agentOnHuman]).toMatchObject([
      { code: "not_owner", status: FORBIDDEN },
      { code: "not_owner", status: FORBIDDEN },
    ]);
    expect([displayNameOf(identities, "release-bot"), displayNameOf(identities, "ada")]).toStrictEqual([null, null]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent that names another agent as its owner can't be set by that agent", () =>
  Effect.gen(function* ownerMustBeHuman() {
    const cookout = yield* TestCookout;
    const boss = yield* cookout.createIdentity("boss-bot");
    yield* cookout.createIdentity("minion", { owner: "boss-bot" });
    const error = yield* refusal(() => boss.client.setDisplayName("minion", "Minion"));

    expect(error).toMatchObject({ code: "not_owner", status: FORBIDDEN });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an admin sets and clears any identity's display name", () =>
  Effect.gen(function* adminSetsAny() {
    const cookout = yield* TestCookout;
    const grace = yield* cookout.createIdentity("grace", { kind: "human" });
    yield* answer(() => cookout.client.setDisplayName("grace", "Amazing Grace"));
    const set = yield* answer(grace.client.whoami);
    const { identity: cleared } = yield* answer(() => cookout.client.setDisplayName("grace", null));
    const after = yield* answer(grace.client.whoami);

    expect(set.identity.displayName).toBe("Amazing Grace");
    expect(cleared).toStrictEqual(grace.identity);
    expect(after.identity).toStrictEqual(grace.identity);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an admin creates an identity with a display name", () =>
  Effect.gen(function* createWithDisplayName() {
    const cookout = yield* TestCookout;
    const created = yield* answer(() =>
      cookout.client.createIdentity({ displayName: " Linus T ", kind: "human", name: "linus" }),
    );
    const whoami = yield* answer(cookout.clientFor(created.token).whoami);

    expect(created.identity.displayName).toBe("Linus T");
    expect(whoami).toStrictEqual({ identity: created.identity });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a display name is 1-80 characters after trimming, and any other is refused with 400", () =>
  Effect.gen(function* lengthRule() {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("grace", { kind: "human" });
    const longest = Str.repeat(LONGEST)("g");
    const kept = yield* answer(() => cookout.client.setDisplayName("grace", `  ${longest}  `));
    const refusals = yield* Effect.forEach(
      ["", "   ", `${longest}g`],
      (displayName) => refusal(() => cookout.client.setDisplayName("grace", displayName)),
      { concurrency: 1 },
    );
    const onCreate = yield* refusal(() =>
      cookout.client.createIdentity({ displayName: " ", kind: "human", name: "blank" }),
    );
    const invalid = { code: "invalid_request", details: [{ path: ["displayName"] }], status: BAD_REQUEST };

    expect(kept.identity.displayName).toBe(longest);
    expect([...refusals, onCreate]).toMatchObject([invalid, invalid, invalid, invalid]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("setting the display name of a missing identity is a 404", () =>
  Effect.gen(function* missingIdentity() {
    const cookout = yield* TestCookout;
    const error = yield* refusal(() => cookout.client.setDisplayName("nobody", "Nobody"));

    expect(error).toMatchObject({ code: "identity_not_found", status: NOT_FOUND });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a display name change reaches every all-channels watcher at once as an identity event", () =>
  Effect.gen(function* liveChange() {
    const cookout = yield* TestCookout;
    const ada = yield* cookout.createIdentity("ada", { kind: "human" });
    const grace = yield* cookout.createIdentity("grace", { kind: "human" });
    yield* cookout.createIdentity("release-bot", { owner: "ada" });
    const events = yield* watchingAllChannels(grace.client);
    const { identity } = yield* answer(() => ada.client.setDisplayName("release-bot", "Release bot"));
    const event = yield* answer(() => events.next());

    expect(event).toStrictEqual({ done: false, value: { identity, type: "identity" } });
  }).pipe(Effect.provide(testCookout())),
);
