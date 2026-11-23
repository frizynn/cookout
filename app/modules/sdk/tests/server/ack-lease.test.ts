import type { CookoutClient, MessageId } from "../../index.ts";
import { TestCookout, answer, refusal, testCookout, twoSessions } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

const CONFLICT = 409;
const FORBIDDEN = 403;

function postIn(client: CookoutClient): Effect.Effect<MessageId> {
  return Effect.map(
    answer(() => client.createMessage({ channel: "grill", text: "to ack" })),
    ({ message }) => message.id,
  );
}

it.effect("an ack without a lease ID goes through while nobody holds the lease", () =>
  Effect.gen(function* ackWithoutLease() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    const id = yield* postIn(first);
    const { readPosition } = yield* answer(() => first.ack(id));

    expect(readPosition.messageId).toBe(id);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an ack without a lease ID while another session holds the lease is 409 lease_required", () =>
  Effect.gen(function* ackWhileHeld() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    const id = yield* postIn(first);
    const error = yield* refusal(() => second.ack(id));
    const held = yield* answer(() => first.ack(id));

    expect(error).toMatchObject({ code: "lease_required", status: CONFLICT });
    expect(held.readPosition.messageId).toBe(id);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an ack with a lease ID another session took over is 409 lease_lost", () =>
  Effect.gen(function* ackWithStaleLease() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    yield* answer(() => second.join({ as: "auth-griller", force: true }));
    const id = yield* postIn(second);
    const error = yield* refusal(() => first.ack(id));

    expect(error).toMatchObject({ code: "lease_lost", status: CONFLICT });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("other writes go through without the lease while another session holds it", () =>
  Effect.gen(function* writesWithoutLease() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    const id = yield* postIn(second);
    const followed = yield* answer(() => second.follow(id));
    const subscribed = yield* answer(() => second.subscribe("grill"));

    expect([followed.following, subscribed.subscribed]).toStrictEqual([true, true]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a human acks with no lease ID, and a lease ID a human sends is never checked", () =>
  Effect.gen(function* humanAck() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    const { leaseId } = yield* answer(() => first.join({ as: "auth-griller" }));
    const human = yield* cookout.createIdentity("ada", { kind: "human" });
    const id = yield* postIn(human.client);
    const withoutLease = yield* answer(() => human.client.ack(id));
    const withStaleLease = yield* answer(() => cookout.clientFor(human.token, { leaseId }).ack(id));

    expect([withoutLease.readPosition.messageId, withStaleLease.readPosition.messageId]).toStrictEqual([id, id]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a human's join, with or without force, is 403 identity_kind", () =>
  Effect.gen(function* humanJoin() {
    const cookout = yield* TestCookout;
    const human = yield* cookout.createIdentity("ada", { kind: "human" });
    const plain = yield* refusal(() => human.client.join({ as: "ada" }));
    const forced = yield* refusal(() => human.client.join({ as: "ada", force: true }));
    const refused = { code: "identity_kind", status: FORBIDDEN };

    expect([plain, forced]).toMatchObject([refused, refused]);
  }).pipe(Effect.provide(testCookout())),
);
