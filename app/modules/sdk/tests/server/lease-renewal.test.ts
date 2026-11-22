import { TestCookout, answer, refusal, testCookout, twoSessions } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

const CONFLICT = 409;

it.effect("posting and reading don't need the lease, even while another session holds it", () =>
  Effect.gen(function* noLeaseNeeded() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    const { message } = yield* answer(() =>
      second.createMessage({ channel: "grill", text: "posted without the lease" }),
    );
    const channels = yield* answer(() => second.listChannels());
    const thread = yield* answer(() => second.getThread(message.id));

    expect(message.author.name).toBe("auth-griller");
    expect(channels).toMatchObject({ channels: [{ name: "grill" }] });
    expect(thread).toMatchObject({ parent: { id: message.id } });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("any request carrying the lease ID renews it: 50 s, a request, 50 s more, still held", () =>
  Effect.gen(function* renewedByRequest() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    yield* TestClock.adjust("50 seconds");
    yield* answer(() => first.listChannels());
    yield* TestClock.adjust("50 seconds");
    const error = yield* refusal(() => second.join({ as: "auth-griller" }));

    expect(error).toMatchObject({
      code: "lease_held",
      details: { heldUntil: "2026-01-01T00:01:50.000Z" },
      status: CONFLICT,
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a request without the lease ID doesn't renew it", () =>
  Effect.gen(function* notRenewed() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    yield* TestClock.adjust("50 seconds");
    yield* answer(() => second.listChannels());
    yield* TestClock.adjust("10 seconds");
    const lease = yield* answer(() => second.join({ as: "auth-griller" }));

    expect(lease).toMatchObject({ expiresAt: "2026-01-01T00:02:00.000Z" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a lease left idle for 60 s expires, and the next join succeeds", () =>
  Effect.gen(function* idleExpires() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    yield* TestClock.adjust("59999 millis");
    const held = yield* refusal(() => second.join({ as: "auth-griller" }));
    yield* TestClock.adjust("1 millis");
    const lease = yield* answer(() => second.join({ as: "auth-griller" }));

    expect(held).toMatchObject({ code: "lease_held" });
    expect(lease).toMatchObject({ expiresAt: "2026-01-01T00:02:00.000Z" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect(
  "after its lease expires a session still posts and reads, but an action that needs the lease gets lease_lost",
  () =>
    Effect.gen(function* afterExpiry() {
      const cookout = yield* TestCookout;
      const { first, second } = yield* twoSessions(cookout);
      yield* answer(() => first.join({ as: "auth-griller" }));
      yield* TestClock.adjust("60 seconds");
      const stillWorks = yield* Effect.all(
        [
          answer(() => first.createMessage({ channel: "grill", text: "still here" })),
          answer(() => first.listChannels()),
        ],
        { concurrency: 1 },
      );
      const error = yield* refusal(() => first.leave());
      const lease = yield* answer(() => second.join({ as: "auth-griller" }));

      expect(stillWorks).toMatchObject([{ message: { text: "still here" } }, { channels: [{ name: "grill" }] }]);
      expect(error).toMatchObject({ code: "lease_lost", details: { heldUntil: null }, status: CONFLICT });
      expect(lease).toMatchObject({ expiresAt: "2026-01-01T00:02:00.000Z" });
    }).pipe(Effect.provide(testCookout())),
);
