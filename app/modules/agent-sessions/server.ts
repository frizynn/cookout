/**
 * Agent sessions on the backend: the `AgentSessions` service, the join and leave routes, and the check an open
 * stream makes that its agent session token is still live. `join` issues an agent session token that authenticates
 * as the agent; it expires after its idle expiry unused (default 7 days, at most `COOKOUT_MAX_IDLE_EXPIRY`), and
 * each request sent with it moves its expiry on (Matt, 2026-11-23, mattpocock/cookout#114). Routes sit behind the
 * server's token gate, which authenticates agent session tokens like any other.
 */
import {
  AgentSessionResponseSchema,
  JoinRequestSchema,
  LeaveResponseSchema,
  ListAgentSessionsResponseSchema,
  RevokeAgentSessionResponseSchema,
} from "./lib/server/wire.ts";
import { AgentSessionSent, Caller } from "../identities/server.ts";
import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { AgentSessions } from "./lib/server/service.ts";
import type { Refusal } from "../http/index.ts";
import type { Route } from "../http/server.ts";
import type { StorageUnavailable } from "../storage/server.ts";
import { agentSessionPath } from "./index.ts";
import { agentSessionRequired } from "./lib/server/refusals.ts";

const ALL_ERRORS = { errors: "all" } as const;

const joinRoute: Route<Caller | AgentSessions> = {
  handle: () =>
    Effect.gen(function* joinRouteHandler() {
      const body = yield* HttpServerRequest.schemaBodyJson(JoinRequestSchema, ALL_ERRORS);
      const caller = yield* Caller;
      const agentSessions = yield* AgentSessions;
      const issued = yield* agentSessions.join(caller, body);
      return yield* HttpServerResponse.schemaJson(AgentSessionResponseSchema)(issued);
    }),
  method: "POST",
  path: agentSessionPath,
};

const leaveRoute: Route<Caller | AgentSessions> = {
  handle: () =>
    Effect.gen(function* leaveRouteHandler() {
      const agentSessions = yield* AgentSessions;
      const sent = yield* AgentSessionSent;
      if (Option.isNone(sent)) {
        return yield* Effect.fail(agentSessionRequired);
      }
      yield* agentSessions.leave(sent.value);
      return yield* HttpServerResponse.schemaJson(LeaveResponseSchema)({ revoked: true });
    }),
  method: "DELETE",
  path: agentSessionPath,
};

/**
 * Ends with the 401 refusal (`agent_session_revoked` or `agent_session_expired`) the request's agent session token
 * would now get, once it is no longer live, checking every 30 s and moving its expiry on while the stream is open.
 * For any other token it never ends.
 * @internal
 */
export const sentAgentSessionEnded: Effect.Effect<Refusal, StorageUnavailable, AgentSessions> = Effect.gen(
  function* watchSentAgentSession() {
    const agentSessions = yield* AgentSessions;
    const sent = yield* AgentSessionSent;
    return yield* Option.match(sent, { onNone: () => Effect.never, onSome: agentSessions.untilEnded });
  },
);

export { AgentSessions } from "./lib/server/service.ts";
export { agentSessionsLayer } from "./lib/server/layer.ts";

/**
 * The agent session routes, for the server's route list: join and leave.
 * @internal
 */
export const agentSessionRoutes: readonly Route<Caller | AgentSessions>[] = [joinRoute, leaveRoute];

/**
 * The routes an agent's owner or an admin lists and revokes its agent session token with, for the server's route list.
 * @internal
 */
export { ownerRoutes as agentSessionOwnerRoutes } from "./lib/server/owner-routes.ts";

/** The response Schemas of the agent session routes, for the SDK's generated validators. */
export const agentSessionResponseSchemas = {
  AgentSessionResponse: AgentSessionResponseSchema,
  LeaveResponse: LeaveResponseSchema,
  ListAgentSessionsResponse: ListAgentSessionsResponseSchema,
  RevokeAgentSessionResponse: RevokeAgentSessionResponseSchema,
};
