/**
 * The identity lease on the backend: the `Leases` service other modules use
 * to require the lease, the join and leave routes, and the renewal every
 * request carrying the live lease ID gets. A lease lasts `COOKOUT_LEASE_SECONDS`
 * (default 60) after the last request that carried it, timed by the Effect
 * clock. Routes sit behind the server's token gate.
 */
import { Caller, requireToken } from "../identities/server.ts";
import { Effect, String as Str } from "effect";
import type { Gate, Route } from "../http/server.ts";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { JoinRequestSchema, LeaseResponseSchema, LeaveResponseSchema } from "./lib/server/wire.ts";
import { leaseHeader, leasePath } from "./index.ts";
import type { Identities } from "../identities/server.ts";
import type { LeaseRule } from "./lib/server/service.ts";
import { Leases } from "./lib/server/service.ts";
import type { Refusal } from "../http/index.ts";
import type { StorageUnavailable } from "../storage/server.ts";

type GateNeeds = Identities | Leases | HttpServerRequest.HttpServerRequest;

const ALL_ERRORS = { errors: "all" } as const;

const sentLeaseId: Effect.Effect<string | undefined, never, HttpServerRequest.HttpServerRequest> = Effect.map(
  HttpServerRequest.HttpServerRequest,
  (request) => request.headers[leaseHeader],
);

const joinRoute: Route<Caller | Leases> = {
  handle: () =>
    Effect.gen(function* joinRouteHandler() {
      const body = yield* HttpServerRequest.schemaBodyJson(JoinRequestSchema, ALL_ERRORS);
      const caller = yield* Caller;
      const leases = yield* Leases;
      const sent = yield* sentLeaseId;
      const lease = yield* leases.join(caller, body, sent);
      return yield* HttpServerResponse.schemaJson(LeaseResponseSchema)(lease);
    }),
  method: "POST",
  path: leasePath,
};

const leaveRoute: Route<Caller | Leases> = {
  handle: () =>
    Effect.gen(function* leaveRouteHandler() {
      const caller = yield* Caller;
      const leases = yield* Leases;
      const sent = yield* sentLeaseId;
      yield* leases.leave(caller, sent);
      return yield* HttpServerResponse.schemaJson(LeaveResponseSchema)({ released: true });
    }),
  method: "DELETE",
  path: leasePath,
};

const otherWritesRule: LeaseRule = "none";

function ruleFor(request: HttpServerRequest.HttpServerRequest): LeaseRule {
  if (request.method === "GET" || Str.startsWith(leasePath)(request.url)) {
    return "none";
  }
  return otherWritesRule;
}

function requiringRule(
  rule: (request: HttpServerRequest.HttpServerRequest) => LeaseRule,
): Effect.Effect<void, Refusal | StorageUnavailable, Caller | Leases | HttpServerRequest.HttpServerRequest> {
  return Effect.gen(function* requireLeaseByRule() {
    const caller = yield* Caller;
    const leases = yield* Leases;
    const request = yield* HttpServerRequest.HttpServerRequest;
    yield* leases.requireLease(caller, request.headers[leaseHeader], rule(request));
  });
}

function renewingLease<Value, Failure, Needs>(
  effect: Effect.Effect<Value, Failure, Needs>,
): Effect.Effect<
  Value,
  Failure | Refusal | StorageUnavailable,
  Needs | Caller | Leases | HttpServerRequest.HttpServerRequest
> {
  return Effect.gen(function* renewSentLease() {
    const caller = yield* Caller;
    const leases = yield* Leases;
    const sent = yield* sentLeaseId;
    yield* leases.renew(caller, sent);
    yield* requiringRule(ruleFor);
    return yield* effect;
  });
}

function authenticateAndRenew<Value, Failure, Needs>(
  effect: Effect.Effect<Value, Failure, Needs>,
): Effect.Effect<Value, Failure | Refusal | StorageUnavailable, Exclude<Needs, Caller> | GateNeeds> {
  return renewingLease(effect).pipe(requireToken);
}

/**
 * Ack's and watch's need of the lease: the live lease ID, or none while nobody holds a live lease on the caller's
 * identity, which lets the web UI ack on view without taking one (ADR 0004). A stale or expired lease ID is 409
 * `lease_lost`; none while another session holds the lease is 409 `lease_required`.
 * @internal
 */
export const requireLeaseWhileHeld: Effect.Effect<
  void,
  Refusal | StorageUnavailable,
  Caller | Leases | HttpServerRequest.HttpServerRequest
> = requiringRule(() => "while-held");

/**
 * The gate every route but `/v1/health` sits behind: `requireToken`, then the renewal of the caller's lease if the
 * request carries its live lease ID. A stale lease ID renews nothing and doesn't block the request: only the actions
 * that call `requireLease` refuse it.
 * @internal
 */
export const requireTokenAndRenewLease: Gate<Caller, GateNeeds, Refusal | StorageUnavailable> = authenticateAndRenew;

export { Leases, leasesLayer } from "./lib/server/service.ts";

/**
 * The lease routes, for the server's route list: join and leave.
 * @internal
 */
export const leaseRoutes: readonly Route<Caller | Leases>[] = [joinRoute, leaveRoute];

/** The response Schemas of the lease routes, for the SDK's generated validators. */
export const leaseResponseSchemas = {
  LeaseResponse: LeaseResponseSchema,
  LeaveResponse: LeaveResponseSchema,
};
