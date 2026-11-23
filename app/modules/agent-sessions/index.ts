/**
 * Agent sessions on the wire, shared by the server, the SDK and the CLI: the route `join` and `leave` use, their
 * requests and answers, the idle expiry's format, and the codes they refuse with. `join` issues an agent session
 * token, a bearer token that acts as the agent for one session (Matt, 2026-11-23, mattpocock/cookout#114).
 */
import type { IdentityName, Token } from "../identities/index.ts";
import type { IsoTime } from "../time/index.ts";

/** `POST /v1/agent-session` joins (issues an agent session token); `DELETE /v1/agent-session` leaves (revokes it). */
export const agentSessionPath = "/v1/agent-session";

/**
 * `GET /v1/identities/:name/agent-session` lists the agent's live agent session token (`ListAgentSessionsResponse`),
 * and `DELETE` revokes it (`RevokeAgentSessionResponse`): its session's next request is 401 `agent_session_revoked`.
 * Only the agent's owner or an admin may; anyone else is 403 `not_owner` (Matt, 2026-11-23, mattpocock/cookout#118).
 */
export const identityAgentSessionPath = "/v1/identities/:name/agent-session";

/** How long an agent session token lives unused when `join` doesn't ask: 7 days. */
export const defaultIdleExpiry = "7d";

/**
 * The format of an idle expiry: a whole number of seconds, minutes, hours or days, such as `30d` or `12h`. An
 * agent session token expires once it goes this long unused.
 */
export const idleExpiryPattern = /^[1-9]\d{0,6}[smhd]$/u;

/**
 * The body of `POST /v1/agent-session`. Sent with an agent's token, `as` must be that agent: a check, not a switch.
 * Sent with a human's token, `as` names an agent the human owns, or creates one (Matt, 2026-11-23,
 * mattpocock/cookout#119): an agent the caller owns by that name is joined; else a free name is created, owned by
 * the caller; else, when someone else has the name, `<caller>/<name>` is joined, or created. A human's name, or
 * `<other>/<name>`, is refused. This is the one route a human's token may use from an agent tool.
 */
export interface JoinRequest {
  readonly as: string;
  /** Joins even while the agent has a live agent session token, which is revoked at once. */
  readonly force?: boolean;
  /** How long the token may go unused before it expires, such as `30d`. Default `7d`; at most `COOKOUT_MAX_IDLE_EXPIRY`. */
  readonly idleExpiry?: string;
  /** The host the agent joins from, such as the machine's hostname, shown to its owner. 1–253 characters. */
  readonly host?: string;
}

/** The answer to `join`. */
export interface AgentSessionResponse {
  /** Send it as the bearer token to act as the agent for this session. Shown this once. */
  readonly agentSessionToken: Token;
  readonly issuedAt: IsoTime;
  /** Each request sent with the token moves it forward by the idle expiry. */
  readonly expiresAt: IsoTime;
  /** The agent joined, such as `ada/triage-agent` when a human's `as: "triage-agent"` was someone else's. */
  readonly identity: IdentityName;
  /** Whether this join created the agent, owned by the human who joined. */
  readonly created: boolean;
}

/** An agent's live agent session token as its owner sees it: when it was issued and last used, never the token. */
export interface ListedAgentSession {
  readonly issuedAt: IsoTime;
  /** Left out until a request is sent with the token. */
  readonly lastUsedAt?: IsoTime;
  readonly expiresAt: IsoTime;
  /** The host it joined from, if the joining client said. */
  readonly host?: string;
}

/** The answer to listing an agent's agent session tokens: its live one, or none. */
export interface ListAgentSessionsResponse {
  readonly agentSessions: readonly ListedAgentSession[];
}

/** The answer to revoking an agent's agent session token: `false` when it had no live one. */
export interface RevokeAgentSessionResponse {
  readonly revoked: boolean;
}

/** The answer to `leave`. */
export interface LeaveResponse {
  readonly revoked: true;
}

/** The `details` of the 409 `agent_session_live` refusal: when the agent's live agent session token expires if unused. */
export interface AgentSessionLiveDetails {
  readonly expiresAt: IsoTime;
}

/** The `details` of the 400 `idle_expiry_too_long` refusal: the longest idle expiry this cookout allows. */
export interface IdleExpiryTooLongDetails {
  readonly maxIdleExpiry: string;
}

/**
 * The 401 code for an agent session token that was revoked: by `leave`, another session's `join --force`, or its
 * agent's owner or an admin.
 */
export const agentSessionRevoked = "agent_session_revoked";

/** The 401 code for an agent session token that went unused past its expiry. */
export const agentSessionExpired = "agent_session_expired";

/**
 * The codes join and leave refuse with: the 403s `not_your_identity` (an agent joins as another identity),
 * `identity_kind` (join as a human: only agents join) and `not_owner` (a human joins `<other>/<name>`; listed with
 * the identity codes), the 409s
 * `agent_session_live` (join while the agent has a live agent session token) and `identity_deactivated` (join a
 * Deactivated agent), the 400s `idle_expiry_too_long` and `agent_session_required` (leave sent without an agent session token),
 * and the 401s any request sent with an ended agent session token gets.
 */
export const agentSessionErrorCodes = [
  "not_your_identity",
  "identity_kind",
  "agent_session_live",
  "identity_deactivated",
  "idle_expiry_too_long",
  "agent_session_required",
  agentSessionRevoked,
  agentSessionExpired,
] as const;
