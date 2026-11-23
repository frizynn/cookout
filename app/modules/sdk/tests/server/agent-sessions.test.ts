import type { CookoutClient, CookoutEvent, EventStream, JoinRequest } from "../../index.ts";
import { Duration, Effect, Fiber } from "effect";
import { TestCookout, answer, refusal, testCookout, twoSessions } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";
import type { TestCookoutService } from "../../../testing/server.ts";

const UNAUTHORIZED = 401;
const BAD_REQUEST = 400;
const FORBIDDEN = 403;
const CONFLICT = 409;
const PAST_A_CHECK = 31;
const FIFTY = 50;
const SIXTY = 60;
const AS = { as: "auth-griller" } as const;
const ONE_AT_A_TIME = { concurrency: 1 } as const;

function watching(client: CookoutClient): Effect.Effect<AsyncIterator<CookoutEvent>, never, Scope.Scope> {
  return Effect.map(
    Effect.acquireRelease(
      answer(() => client.watch()),
      (events: EventStream) => answer(() => events.close()),
    ),
    (events) => events[Symbol.asyncIterator](),
  );
}

it.effect("join issues an agent session token that acts as the agent, expiring 7 days on if unused", () =>
  Effect.gen(function* joinIssues() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    const issued = yield* answer(() => first.join(AS));
    const session = cookout.clientFor(issued.agentSessionToken);
    const me = yield* answer(() => session.whoami());
    const { message } = yield* answer(() => session.createMessage({ channel: "grill", text: "from the session" }));

    expect(issued).toStrictEqual({
      agentSessionToken: issued.agentSessionToken,
      created: false,
      expiresAt: "2026-01-08T00:00:00.000Z",
      identity: "auth-griller",
      issuedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(issued.agentSessionToken).toMatch(/^cookout_[\w-]{43}$/u);
    expect(me).toMatchObject({ identity: { kind: "agent", name: "auth-griller" } });
    expect(message.author.name).toBe("auth-griller");
  }).pipe(Effect.provide(testCookout({ secrets: "live" }))),
);

it.effect("join refuses another identity's name, a human, and no token", () =>
  Effect.gen(function* joinRefuses() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    yield* cookout.createIdentity("someone-else");
    const human = yield* cookout.createIdentity("ann", { kind: "human" });
    const errors = yield* Effect.all(
      [
        refusal(() => first.join({ as: "someone-else" })),
        refusal(() => human.client.join({ as: "ann" })),
        refusal(() => cookout.clientFor("").join(AS)),
      ],
      ONE_AT_A_TIME,
    );

    expect(errors).toMatchObject([
      { code: "not_your_identity", status: FORBIDDEN },
      { code: "identity_kind", status: FORBIDDEN },
      { code: "token_missing", status: UNAUTHORIZED },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a second join while the agent has a live token is 409; --force revokes the first at once", () =>
  Effect.gen(function* oneLive() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    const firstIssued = yield* answer(() => first.join(AS));
    yield* TestClock.adjust("1 hour");
    const refused = yield* refusal(() => second.join(AS));
    const forced = yield* answer(() => second.join({ ...AS, force: true }));
    const [firstAfter, secondAfter] = yield* Effect.all(
      [
        refusal(() => cookout.clientFor(firstIssued.agentSessionToken).whoami()),
        answer(() => cookout.clientFor(forced.agentSessionToken).whoami()),
      ],
      ONE_AT_A_TIME,
    );

    expect(refused).toMatchObject({
      code: "agent_session_live",
      details: { expiresAt: "2026-01-08T00:00:00.000Z" },
      status: CONFLICT,
    });
    expect(firstAfter).toMatchObject({ code: "agent_session_revoked", status: UNAUTHORIZED });
    expect(secondAfter).toMatchObject({ identity: { name: "auth-griller" } });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("--idle-expiry asks for a longer life, up to the 90-day ceiling", () =>
  Effect.gen(function* idleExpiry() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    const tooLong = yield* refusal(() => second.join({ ...AS, idleExpiry: "365d" }));
    const badFormat = yield* refusal(() => second.join({ ...AS, idleExpiry: "a while" }));
    const issued = yield* answer(() => first.join({ ...AS, idleExpiry: "30d" }));

    expect(tooLong).toMatchObject({
      code: "idle_expiry_too_long",
      details: { maxIdleExpiry: "90d" },
      status: BAD_REQUEST,
    });
    expect(badFormat).toMatchObject({ code: "invalid_request", status: BAD_REQUEST });
    expect(issued).toMatchObject({ expiresAt: "2026-01-31T00:00:00.000Z" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("COOKOUT_MAX_IDLE_EXPIRY raises the ceiling", () =>
  Effect.gen(function* raisedCeiling() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    const issued = yield* answer(() => first.join({ ...AS, idleExpiry: "365d" }));

    expect(issued).toMatchObject({ expiresAt: "2027-01-01T00:00:00.000Z" });
  }).pipe(Effect.provide(testCookout({ maxIdleExpiry: "400d" }))),
);

function usedAfter(session: CookoutClient, minutes: number): Effect.Effect<unknown> {
  return Effect.andThen(
    TestClock.adjust(Duration.minutes(minutes)),
    answer(() => session.whoami()),
  );
}

function refusedAfter(session: CookoutClient, minutes: number): Effect.Effect<unknown> {
  return Effect.andThen(
    TestClock.adjust(Duration.minutes(minutes)),
    refusal(() => session.whoami()),
  );
}

function joined(
  cookout: TestCookoutService,
  client: CookoutClient,
  request: JoinRequest,
): Effect.Effect<CookoutClient> {
  return Effect.map(
    answer(() => client.join(request)),
    ({ agentSessionToken }) => cookout.clientFor(agentSessionToken),
  );
}

it.effect("a token used within its idle expiry keeps living; one left unused past it is refused", () =>
  Effect.gen(function* idleExpires() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    const session = yield* joined(cookout, first, { ...AS, idleExpiry: "1h" });
    yield* usedAfter(session, FIFTY);
    const stillLive = yield* usedAfter(session, FIFTY);
    const expired = yield* refusedAfter(session, SIXTY);
    const next = yield* answer(() => second.join(AS));

    expect(stillLive).toMatchObject({ identity: { name: "auth-griller" } });
    expect(expired).toMatchObject({ code: "agent_session_expired", status: UNAUTHORIZED });
    expect(next).toMatchObject({ issuedAt: "2026-01-01T02:40:00.000Z" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("leave revokes the agent session token it is sent with; the Identity token still works", () =>
  Effect.gen(function* leaveRevokes() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    const session = yield* joined(cookout, first, AS);
    const left = yield* answer(() => session.leave());
    const [after, leaveWithIdentityToken, withIdentityToken, rejoined] = yield* Effect.all(
      [
        refusal(() => session.whoami()),
        refusal(() => first.leave()),
        answer(() => first.whoami()),
        answer(() => second.join(AS)),
      ],
      ONE_AT_A_TIME,
    );

    expect(left).toStrictEqual({ revoked: true });
    expect(after).toMatchObject({ code: "agent_session_revoked", status: UNAUTHORIZED });
    expect(withIdentityToken).toMatchObject({ identity: { name: "auth-griller" } });
    expect(leaveWithIdentityToken).toMatchObject({ code: "agent_session_required", status: BAD_REQUEST });
    expect(rejoined).toMatchObject({ issuedAt: "2026-01-01T00:00:00.000Z" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("ack and watch work for an agent that never joined, even while another session has", () =>
  Effect.gen(function* noJoinNeeded() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join(AS));
    const ann = yield* cookout.createIdentity("ann", { kind: "human" });
    const { message } = yield* answer(() => ann.client.createMessage({ channel: "grill", text: "@auth-griller hi" }));
    const events = yield* watching(second);
    const acked = yield* answer(() => second.ack(message.id));
    const next = yield* Effect.promise(() => events.next());

    expect(acked).toMatchObject({ readPosition: { messageId: message.id } });
    expect(next.value).toMatchObject({ type: "read-position" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a stream opened with an agent session token ends with agent_session_revoked after another --force", () =>
  Effect.gen(function* streamEnds() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    const issued = yield* answer(() => first.join(AS));
    const events = yield* watching(cookout.clientFor(issued.agentSessionToken));
    yield* answer(() => second.join({ ...AS, force: true }));
    const next = yield* Effect.forkChild(refusal(() => events.next()));
    yield* TestClock.adjust(Duration.seconds(PAST_A_CHECK));
    const error = yield* Fiber.join(next);

    expect(error).toMatchObject({ code: "agent_session_revoked" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a stream opened with an agent session token ends with token_revoked once its identity is deactivated", () =>
  Effect.gen(function* streamEndsOnDeactivation() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    const issued = yield* answer(() => first.join(AS));
    const events = yield* watching(cookout.clientFor(issued.agentSessionToken));
    yield* answer(() => cookout.client.deactivateIdentity(AS.as));
    const next = yield* Effect.forkChild(refusal(() => events.next()));
    yield* TestClock.adjust(Duration.seconds(PAST_A_CHECK));
    const error = yield* Fiber.join(next);

    expect(error).toMatchObject({ code: "token_revoked" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an open stream moves its agent session token's expiry on", () =>
  Effect.gen(function* streamRenews() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    const issued = yield* answer(() => first.join({ ...AS, idleExpiry: "1m" }));
    const session = cookout.clientFor(issued.agentSessionToken);
    yield* watching(session);
    yield* TestClock.adjust("5 minutes");
    const me = yield* answer(() => session.whoami());

    expect(me).toMatchObject({ identity: { name: "auth-griller" } });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a stream whose agent session token expires between checks ends with agent_session_expired", () =>
  Effect.gen(function* streamExpires() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    const session = yield* joined(cookout, first, { ...AS, idleExpiry: "10s" });
    const events = yield* watching(session);
    const next = yield* Effect.forkChild(refusal(() => events.next()));
    yield* TestClock.adjust(Duration.seconds(PAST_A_CHECK));
    const error = yield* Fiber.join(next);

    expect(error).toMatchObject({ code: "agent_session_expired" });
  }).pipe(Effect.provide(testCookout())),
);
