/**
 * Channels on the wire, shared by the server, the SDK and the web: the
 * `ChannelName` brand and its check, the channel as the server shows it, the
 * request and answers of the channel routes, their paths, and the error codes
 * they refuse with.
 */
import type { IdentityName } from "../identities/index.ts";
import type { IsoTime } from "../time/index.ts";

declare const brand: unique symbol;

/** A channel's name: 1–80 lowercase letters, digits or `-`. Unique on a server. */
export type ChannelName = string & { readonly [brand]: "ChannelName" };

/** The rule every channel name follows, for the backend's Schemas. */
export const channelNamePattern = /^[a-z0-9-]{1,80}$/u;

/**
 * Whether `value` follows the channel-name rule; if so, it is a `ChannelName`.
 * @param value The name to check.
 * @returns Whether `value` is a `ChannelName`.
 */
export function isChannelName(value: string): value is ChannelName {
  return channelNamePattern.test(value);
}

/** The description rule, in UTF-16 code units as `String.length` counts them. */
export const descriptionLength = { maximum: 500, minimum: 1 } as const;

/**
 * Who hears a top-level message a person posts in a channel without mentioning anyone. Each is optional; a channel
 * has an owner or a router, never both, and a fallback only beside a router.
 */
export interface ChannelRouting {
  /** The agent that hears every such message, as if it were mentioned. */
  readonly owner?: IdentityName;
  /** The URL asked which agents should hear such a message, signed like a Webhook. */
  readonly router?: string;
  /** The agent that hears it when the router fails, takes too long or picks no one. */
  readonly fallback?: IdentityName;
}

/** A channel as the server shows it. */
export interface Channel extends ChannelRouting {
  readonly name: ChannelName;
  /** 1–500 characters. */
  readonly description?: string;
  readonly createdAt: IsoTime;
}

/**
 * The body of `PUT /v1/channels/:name/routing`, for admins. It replaces the channel's routing: a field left out is
 * cleared.
 */
export interface SetChannelRoutingRequest {
  readonly owner?: string;
  readonly router?: string;
  readonly fallback?: string;
}

/**
 * The answer to setting a channel's routing. `routerSecret` is shown once, when the router URL is new or changed: the
 * router checks the `cookout-signature` header, the HMAC-SHA256 of the body keyed with it.
 */
export interface ChannelRoutingResponse {
  readonly channel: Channel;
  readonly routerSecret?: string;
}

/** `PUT /v1/channels/:name/routing`: sets who hears unmentioned messages in a channel. Admins only. */
export const channelRoutingPath = "/v1/channels/:name/routing";

/** The limits on agents talking to agents, for the whole board. */
export interface BoardLimits {
  /** How many agents one message of an agent may mention. A person has no limit. */
  readonly agentMentions: number;
  /** How many messages in a row agents may post in one thread before a person writes there, counted only when two agents or more take part. */
  readonly agentTurns: number;
}

/** The board's limits before an admin changes them. */
export const defaultBoardLimits: BoardLimits = { agentMentions: 1, agentTurns: 6 };

/** Each limit's allowed range. */
export const boardLimitRange = { maximum: 100, minimum: 1 } as const;

/** The answer to getting or setting the board's limits. */
export interface BoardLimitsResponse {
  readonly limits: BoardLimits;
}

/** `GET /v1/board/limits` shows the limits to anyone; `PUT` changes them, for admins. */
export const boardLimitsPath = "/v1/board/limits";

/** The body of `POST /v1/channels`. The server checks the name and description. */
export interface CreateChannelRequest {
  readonly name: string;
  readonly description?: string;
}

/** The answer to creating or getting a channel. */
export interface ChannelResponse {
  readonly channel: Channel;
}

/** The answer to `GET /v1/channels`: every channel, sorted by name. */
export interface ListChannelsResponse {
  readonly channels: readonly Channel[];
}

/** `GET /v1/channels` lists channels; `POST /v1/channels` creates one, for any identity. */
export const channelsPath = "/v1/channels";

/** `GET /v1/channels/:name`: one channel. */
export const channelPath = "/v1/channels/:name";

/** The codes the channel routes refuse with: a name in use (409) and a missing channel (404). */
export const channelErrorCodes = ["channel_exists", "channel_not_found"] as const;

/**
 * The codes the routing routes and posting refuse with: an owner or fallback that isn't an active agent (422), an
 * owner beside a router or a fallback without one (422), an agent's message mentioning more agents than the board
 * allows (422), and an agent's message past the board's agent turns in a thread (422).
 */
export const routingErrorCodes = [
  "routing_agent_invalid",
  "routing_conflict",
  "agent_mention_limit",
  "agent_turn_limit",
] as const;

/**
 * How a person's top-level message with no mention reached agents: `channel-owner` sent it to the channel's owner,
 * `router` to the agents the channel's router picked, `fallback` to the channel's fallback when the router failed,
 * took too long or picked no one, saying why in `error`.
 */
export interface MessageRoute {
  readonly by: "channel-owner" | "router" | "fallback";
  readonly to: readonly IdentityName[];
  readonly error?: string;
}

/** A message's route: who heard a top-level message a person posted without a mention. Absent when no one was sent it. */
export interface WithRoute {
  readonly route?: MessageRoute;
}
