import { Effect, pipe } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { TestCookout, answer, refusal, testCookout, twoSessions } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import { leasePath } from "../../../leases/index.ts";

const CONFLICT = 409;
const SHORT_LEASE_SECONDS = 5;
const BAD_BODIES = [{}, { as: "Not A Name" }, { as: "auth-griller", force: "yes" }] as const;
const ONE_AT_A_TIME = { concurrency: 1 } as const;

it.effect("join takes the lease for the token's identity and says when it ends", () =>
  Effect.gen(function* joinTakes() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    const lease = yield* answer(() => first.join({ as: "auth-griller" }));

    expect(lease).toStrictEqual({ expiresAt: "2026-01-01T00:01:00.000Z", leaseId: lease.leaseId });
    expect(lease.leaseId).toMatch(/^lease_[\w-]{22}$/u);
  }).pipe(Effect.provide(testCookout({ secrets: "live" }))),
);

it.effect("join refuses a name that isn't the token's identity: the name is a check, not a switch", () =>
  Effect.gen(function* notASwitch() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    yield* cookout.createIdentity("someone-else");
    const error = yield* refusal(() => first.join({ as: "someone-else" }));
    const lease = yield* answer(() => first.join({ as: "auth-griller" }));

    expect(error).toMatchObject({ code: "not_your_identity", status: 403 });
    expect(lease).toMatchObject({ expiresAt: "2026-01-01T00:01:00.000Z" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a second join while the lease is held gets 409 with heldUntil", () =>
  Effect.gen(function* secondJoin() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    yield* TestClock.adjust("10 seconds");
    const error = yield* refusal(() => second.join({ as: "auth-griller" }));

    expect(error).toMatchObject({
      code: "lease_held",
      details: { heldUntil: "2026-01-01T00:01:00.000Z" },
      schemaProblems: [],
      status: CONFLICT,
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the holding session joining again keeps its lease and renews it", () =>
  Effect.gen(function* joinAgain() {
    const cookout = yield* TestCookout;
    const { first } = yield* twoSessions(cookout);
    const lease = yield* answer(() => first.join({ as: "auth-griller" }));
    yield* TestClock.adjust("10 seconds");
    const again = yield* answer(() => first.join({ as: "auth-griller" }));

    expect(again).toStrictEqual({ expiresAt: "2026-01-01T00:01:10.000Z", leaseId: lease.leaseId });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("join needs a token like every other route", () =>
  Effect.gen(function* joinNeedsToken() {
    const cookout = yield* TestCookout;
    yield* twoSessions(cookout);
    const error = yield* refusal(() => cookout.clientFor("").join({ as: "auth-griller" }));

    expect(error).toMatchObject({ code: "token_missing", status: 401 });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("join refuses a body that isn't a join request", () =>
  Effect.gen(function* badJoinBody() {
    const cookout = yield* TestCookout;
    const { agent } = yield* twoSessions(cookout);
    const answers = yield* pipe(
      BAD_BODIES,
      Effect.forEach(
        (body) =>
          HttpClientRequest.post(`${cookout.url}${leasePath}`).pipe(
            HttpClientRequest.bearerToken(agent.token),
            HttpClientRequest.bodyJsonUnsafe(body),
            HttpClient.execute,
            Effect.flatMap((response) => Effect.map(response.json, (json) => ({ json, status: response.status }))),
          ),
        ONE_AT_A_TIME,
      ),
      Effect.provide(FetchHttpClient.layer),
      Effect.orDie,
    );
    const refused = { json: { error: { code: "invalid_request" } }, status: 400 };

    expect(answers).toMatchObject([refused, refused, refused]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the lease length is configurable", () =>
  Effect.gen(function* configurableLength() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    const lease = yield* answer(() => agent.client.join({ as: "agent" }));

    expect(lease).toMatchObject({ expiresAt: "2026-01-01T00:00:05.000Z" });
  }).pipe(Effect.provide(testCookout({ leaseSeconds: SHORT_LEASE_SECONDS }))),
);
