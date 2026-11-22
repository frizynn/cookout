import { Array as Arr, Effect, String as Str, pipe } from "effect";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";

const BAD_REQUEST = 400;
const FIRE = "🔥";
const MOST_FIRES = 250;
const TOO_MANY_FIRES = 251;
const LONGEST = 80;
const TOO_LONG = 81;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const BOOT = "2026-01-01T00:00:00.000Z";

function refusedOn(field: string): object {
  return { code: "invalid_request", details: [{ path: [field] }], status: BAD_REQUEST };
}

it.effect("any identity, not only an admin, can create a channel", () =>
  Effect.gen(function* anyIdentityCreates() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    yield* TestClock.adjust("1 second");
    const created = yield* answer(() =>
      agent.client.createChannel({ description: "Grilling the auth plan", name: "grill-auth" }),
    );

    expect(created).toStrictEqual({
      channel: { createdAt: "2026-01-01T00:00:01.000Z", description: "Grilling the auth plan", name: "grill-auth" },
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a channel can be made without a description", () =>
  Effect.gen(function* noDescription() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("auth-griller", { owner: "matt" });
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    const { channel } = yield* answer(() => agent.client.getChannel("grill"));

    expect(channel).toStrictEqual({ createdAt: BOOT, name: "grill" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("any identity lists channels by name", () =>
  Effect.gen(function* listChannels() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("auth-griller", { owner: "matt" });
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    yield* answer(() => cookout.client.createChannel({ name: "general" }));
    const other = yield* cookout.createIdentity("other");
    const byOther = yield* answer(other.client.listChannels);
    const byAgent = yield* answer(agent.client.listChannels);

    expect(byOther.channels).toMatchObject([{ name: "general" }, { name: "grill" }]);
    expect(byAgent).toStrictEqual(byOther);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a channel name already in use is refused with 409", () =>
  Effect.gen(function* nameInUse() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    const error = yield* refusal(() => agent.client.createChannel({ name: "grill" }));

    expect(error).toMatchObject({ code: "channel_exists", status: 409 });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a bad channel name is refused with 400 and the schema errors", () =>
  Effect.gen(function* badName() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    const error = yield* refusal(() => agent.client.createChannel({ name: "Not Allowed" }));

    expect(error).toMatchObject(refusedOn("name"));
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a description is 1-500 characters", () =>
  Effect.gen(function* descriptionRule() {
    const cookout = yield* TestCookout;
    const created = yield* answer(() =>
      cookout.client.createChannel({ description: Str.repeat(MOST_FIRES)(FIRE), name: "fire" }),
    );
    const refused = yield* pipe(
      ["", Str.repeat(TOO_MANY_FIRES)(FIRE)],
      Effect.forEach(
        (description) => refusal(() => cookout.client.createChannel({ description, name: "too-long" })),
        ONE_AT_A_TIME,
      ),
    );

    expect(created.channel).toMatchObject({ description: Str.repeat(MOST_FIRES)(FIRE) });
    expect(refused).toMatchObject([refusedOn("description"), refusedOn("description")]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("getting a missing channel is a 404", () =>
  Effect.gen(function* missingChannel() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    const error = yield* refusal(() => agent.client.getChannel("nowhere"));

    expect(error).toMatchObject({ code: "channel_not_found", status: 404 });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("channels need a token", () =>
  Effect.gen(function* channelsNeedAToken() {
    const cookout = yield* TestCookout;
    const error = yield* refusal(cookout.clientFor("").listChannels);

    expect(error).toMatchObject({ code: "token_missing", status: 401 });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("channel names are 1-80 lowercase letters, digits or '-'", () =>
  Effect.gen(function* channelNameRule() {
    const cookout = yield* TestCookout;
    const good = ["grill-auth", "a", "v1-2026", Str.repeat(LONGEST)("x")];
    const bad = ["", "Grill", "grill_auth", "grill auth", "#grill", Str.repeat(TOO_LONG)("x")];
    const created = yield* pipe(
      good,
      Effect.forEach((name) => answer(() => cookout.client.createChannel({ name })), ONE_AT_A_TIME),
    );
    const refused = yield* pipe(
      bad,
      Effect.forEach((name) => refusal(() => cookout.client.createChannel({ name })), ONE_AT_A_TIME),
    );

    expect(created).toMatchObject(
      pipe(
        good,
        Arr.map((name) => ({ channel: { name } })),
      ),
    );
    expect(refused).toMatchObject(
      pipe(
        bad,
        Arr.map(() => refusedOn("name")),
      ),
    );
  }).pipe(Effect.provide(testCookout())),
);
