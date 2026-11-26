/**
 * The calls a client makes on who hears a person's message with no mention: a channel's owner, router and fallback,
 * and the board's limits on agents talking to agents. The SDK's `CookoutClient` has them.
 */
import type { BoardLimits, BoardLimitsResponse, ChannelRoutingResponse, SetChannelRoutingRequest } from "./index.ts";

/** Setting a channel's routing and reading or changing the board's limits. */
export interface ChannelRoutingCalls {
  /**
   * `PUT /v1/channels/:name/routing`, admin only: replaces who hears a person's top-level message with no mention in
   * the channel, `owner` (an agent) or `router` (a URL) with an optional `fallback` agent; a field left out is cleared.
   * A new or changed router URL answers `routerSecret` once, the key its requests' `cookout-signature` is made with.
   * 422 `routing_agent_invalid` for an owner or fallback that isn't an active agent, 422 `routing_conflict` for an
   * owner beside a router or a fallback without one.
   */
  readonly setChannelRouting: (name: string, routing: SetChannelRoutingRequest) => Promise<ChannelRoutingResponse>;
  /** `GET /v1/board/limits`: how many agents an agent's message may mention, and how many agent messages in a row a thread takes. */
  readonly boardLimits: () => Promise<BoardLimitsResponse>;
  /** `PUT /v1/board/limits`, admin only: replaces both limits, each 1 to 100. */
  readonly setBoardLimits: (limits: BoardLimits) => Promise<BoardLimitsResponse>;
}
