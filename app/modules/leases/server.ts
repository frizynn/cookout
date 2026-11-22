/**
 * The identity lease on the backend: the `Leases` service other modules use
 * to require the lease, the join and leave routes, and the renewal every
 * request carrying the live lease ID gets. A lease lasts `COOKOUT_LEASE_SECONDS`
 * (default 60) after the last request that carried it, timed by the Effect
 * clock. Routes sit behind the server's token gate.
 */
import { Caller, requireToken } from "../identities/server.ts";
import type { Gate, Route } from "../http/server.ts";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { JoinRequestSchema, LeaseResponseSchema, LeaveResponseSchema } from "./lib/server/wire.ts";
import { leaseHeader, leasePath } from "./index.ts";
import { Effect } from "effect";
import type { Identities } from "../identities/server.ts";
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

function renewingLease<Value, Failure, Needs>(
  effect: Effect.Effect<Value, Failure, Needs>,
): Effect.Effect<Value, Failure | StorageUnavailable, Needs | Caller | Leases | HttpServerRequest.HttpServerRequest> {
  return Effect.gen(function* renewSentLease() {
    const caller = yield* Caller;
    const leases = yield* Leases;
    const sent = yield* sentLeaseId;
    yield* leases.renew(caller, sent);
    return yield* effect;
  });
}

function authenticateAndRenew<Value, Failure, Needs>(
  effect: Effect.Effect<Value, Failure, Needs>,
): Effect.Effect<Value, Failure | Refusal | StorageUnavailable, Exclude<Needs, Caller> | GateNeeds> {
  return renewingLease(effect).pipe(requireToken);
}

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
