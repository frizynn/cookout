import { TestCookout, answer, refusal, testCookout, twoSessions } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

const CONFLICT = 409;
const ONE_AT_A_TIME = { concurrency: 1 } as const;

it.effect("an action that needs the lease, sent without the lease ID, gets 409 with heldUntil", () =>
  Effect.gen(function* withoutLeaseId() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    const error = yield* refusal(() => second.leave());

    expect(error).toMatchObject({
      code: "lease_required",
      details: { heldUntil: "2026-01-01T00:01:00.000Z" },
      status: CONFLICT,
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an action that needs the lease is refused when nobody holds it, with heldUntil null", () =>
  Effect.gen(function* nobodyHolds() {
    const cookout = yield* TestCookout;
    const { second } = yield* twoSessions(cookout);
    const error = yield* refusal(() => second.leave());

    expect(error).toMatchObject({ code: "lease_required", details: { heldUntil: null }, status: CONFLICT });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("join --force takes over a held lease, and the old lease ID stops working at once", () =>
  Effect.gen(function* forceTakesOver() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    const old = yield* answer(() => first.join({ as: "auth-griller" }));
    yield* TestClock.adjust("5 seconds");
    const taken = yield* answer(() => second.join({ as: "auth-griller", force: true }));
    yield* TestClock.adjust("30 seconds");
    const [channels, posted, error, stillHeld] = yield* Effect.all(
      [
        answer(() => first.listChannels()),
        answer(() => first.createMessage({ channel: "grill", text: "hi" })),
        refusal(() => first.leave()),
        answer(() => second.listChannels()),
      ],
      ONE_AT_A_TIME,
    );

    expect({ channels, newLeaseId: taken.leaseId !== old.leaseId, posted, stillHeld, taken }).toMatchObject({
      channels: { channels: [{ name: "grill" }] },
      newLeaseId: true,
      posted: { message: { text: "hi" } },
      stillHeld: { channels: [{ name: "grill" }] },
      taken: { expiresAt: "2026-01-01T00:01:05.000Z" },
    });
    expect(error).toMatchObject({
      code: "lease_lost",
      details: { heldUntil: "2026-01-01T00:01:05.000Z" },
      status: CONFLICT,
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("join --force works when nobody holds the lease", () =>
  Effect.gen(function* forceWhenFree() {
    const cookout = yield* TestCookout;
    const { second } = yield* twoSessions(cookout);
    const lease = yield* answer(() => second.join({ as: "auth-griller", force: true }));

    expect(lease).toMatchObject({ expiresAt: "2026-01-01T00:01:00.000Z" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("leave releases the lease, so the next join succeeds at once", () =>
  Effect.gen(function* leaveReleases() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    const left = yield* answer(() => first.leave());
    const lease = yield* answer(() => second.join({ as: "auth-griller" }));

    expect(left).toStrictEqual({ released: true });
    expect(lease).toMatchObject({ expiresAt: "2026-01-01T00:01:00.000Z" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("after leave the session is back to working without a lease", () =>
  Effect.gen(function* afterLeave() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    yield* answer(() => first.leave());
    const channels = yield* answer(() => first.listChannels());
    const error = yield* refusal(() => first.leave());

    expect(channels.channels).toMatchObject([{ name: "grill" }]);
    expect(error).toMatchObject({ code: "lease_required" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a lease is per identity: another identity joins while this one is held", () =>
  Effect.gen(function* perIdentity() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    const other = yield* cookout.createIdentity("other-agent");
    const lease = yield* answer(() => other.client.join({ as: "other-agent" }));

    expect(lease).toMatchObject({ expiresAt: "2026-01-01T00:01:00.000Z" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a lease ID sent with another identity's token is refused", () =>
  Effect.gen(function* borrowedLease() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    const { leaseId } = yield* answer(() => first.join({ as: "auth-griller" }));
    const other = yield* cookout.createIdentity("other-agent");
    const borrowed = cookout.clientFor(other.token, { leaseId });
    const channels = yield* answer(() => borrowed.listChannels());
    const error = yield* refusal(() => borrowed.leave());

    expect(channels.channels).toMatchObject([{ name: "grill" }]);
    expect(error).toMatchObject({ code: "lease_lost", status: CONFLICT });
  }).pipe(Effect.provide(testCookout())),
);
