import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
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
      return error instanceof CookoutError ? error : expect.unreachable("Not a CookoutError.");
    }),
  );

it.effect("any identity, not only an admin, can create a channel", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    yield* TestClock.adjust("1 second");
    const created = yield* answer(() =>
      agent.client.createChannel({ name: "grill-auth", description: "Grilling the auth plan" }),
    );
    expect(created).toEqual({
      channel: { name: "grill-auth", description: "Grilling the auth plan", createdAt: "2026-01-01T00:00:01.000Z" },
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a channel can be made without a description", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("auth-griller", { owner: "matt" });
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    const { channel } = yield* answer(() => agent.client.getChannel("grill"));
    expect(channel).toEqual({ name: "grill", createdAt: "2026-01-01T00:00:00.000Z" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("any identity lists channels by name", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("auth-griller", { owner: "matt" });
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    yield* answer(() => cookout.client.createChannel({ name: "general" }));
    const other = yield* cookout.createIdentity("other");
    const { channels } = yield* answer(() => other.client.listChannels());
    expect(channels.map((channel) => channel.name)).toEqual(["general", "grill"]);
    expect(yield* answer(() => agent.client.listChannels())).toEqual({ channels });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a channel name already in use is refused with 409", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    const error = yield* refusal(() => agent.client.createChannel({ name: "grill" }));
    expect(error).toMatchObject({ status: 409, code: "channel_exists" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a bad channel name is refused with 400 and the schema errors", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    const error = yield* refusal(() => agent.client.createChannel({ name: "Not Allowed" }));
    expect(error).toMatchObject({ status: 400, code: "invalid_request" });
    expect(error.details).toEqual([expect.objectContaining({ path: ["name"] })]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("getting a missing channel is a 404", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    const error = yield* refusal(() => agent.client.getChannel("nowhere"));
    expect(error).toMatchObject({ status: 404, code: "channel_not_found" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("channels need a token", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const error = yield* refusal(() => cookout.clientFor(undefined).listChannels());
    expect(error).toMatchObject({ status: 401, code: "token_missing" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("channel names are 1-80 lowercase letters, digits or '-'", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    for (const name of ["grill-auth", "a", "v1-2026", "x".repeat(80)]) {
      expect((yield* answer(() => cookout.client.createChannel({ name }))).channel.name).toBe(name);
    }
    for (const name of ["", "Grill", "grill_auth", "grill auth", "#grill", "x".repeat(81)]) {
      const error = yield* refusal(() => cookout.client.createChannel({ name }));
      expect(error, name).toMatchObject({ status: 400, code: "invalid_request" });
      expect(error.details, name).toEqual([expect.objectContaining({ path: ["name"] })]);
    }
  }).pipe(Effect.provide(testCookout())),
);
