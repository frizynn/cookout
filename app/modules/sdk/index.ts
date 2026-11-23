/**
 * `@ai-hero/cookout/sdk`: a client for a cookout server, in plain TypeScript
 * for Node and the browser. Every answer is checked against the protocol; one
 * that doesn't match fails with `CookoutError` code `bad_response`. A refusal
 * with a code this SDK doesn't know (from a newer server) still fails with
 * that code, typed as `UnknownErrorCode`; its `schemaProblems` lists an `invalid_request`'s schema errors.
 * `refusalOf` turns anything a call threw into a code and message (`unreachable` unless a `CookoutError`).
 */
import type {
  AckResponse,
  FollowResponse,
  InboxHistoryQuery,
  InboxHistoryResponse,
  InboxResponse,
  SubscriptionResponse,
} from "./lib/inbox.ts";
import type {
  AddCommandRequest,
  CallCommandRequest,
  CallCommandResponse,
  CommandWithSecretResponse,
  ListCommandsResponse,
} from "./lib/commands.ts";
import type { AgentSessionResponse, JoinRequest, LeaveResponse } from "./lib/agent-sessions.ts";
import type { ChannelResponse, CreateChannelRequest, ListChannelsResponse } from "./lib/channels.ts";
import type {
  CreateIdentityRequest,
  DeactivateIdentityResponse,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListIdentitiesQuery,
  ListIdentitiesResponse,
} from "../identities/index.ts";
import type { EventStream, WatchOptions } from "./lib/events.ts";
import type {
  ListMessagesQuery,
  ListMessagesResponse,
  MessageId,
  MessageResponse,
  PostMessageRequest,
  ThreadResponse,
} from "./lib/messages.ts";
import { eventCalls, eventOf } from "./lib/events.ts";
import type { HealthResponse } from "../http/index.ts";
import { agentSessionCalls } from "./lib/agent-sessions.ts";
import { channelCalls } from "./lib/channels.ts";
import { commandCalls } from "./lib/commands.ts";
import { connectionFor } from "./lib/request.ts";
import { identityCalls } from "./lib/identities.ts";
import { inboxCalls } from "./lib/inbox.ts";
import { messageCalls } from "./lib/messages.ts";

export type {
  Channel,
  ChannelName,
  ChannelResponse,
  CreateChannelRequest,
  ListChannelsResponse,
} from "./lib/channels.ts";
export type {
  AddCommandRequest,
  CallCommandRequest,
  CallCommandResponse,
  Command,
  CommandName,
  CommandSecret,
  CommandWithSecretResponse,
  JsonSchema,
  ListCommandsResponse,
} from "../commands/index.ts";
export type { HealthResponse, SchemaProblem } from "../http/index.ts";
export type { IsoTime } from "../time/index.ts";
export type * from "./lib/identity-types.ts";
export type {
  Author,
  JsonValue,
  ListMessagesQuery,
  ListMessagesResponse,
  Message,
  MessageFields,
  MessageId,
  MessageResponse,
  PostMessageRequest,
  Reply,
  ThreadResponse,
  TopLevelMessage,
} from "../messages/index.ts";
export type {
  AgentSessionLiveDetails,
  AgentSessionResponse,
  IdleExpiryTooLongDetails,
  JoinRequest,
  LeaveResponse,
} from "../agent-sessions/index.ts";
export type {
  AckRequest,
  AckResponse,
  FollowResponse,
  InboxHistoryItem,
  InboxHistoryQuery,
  InboxHistoryResponse,
  InboxItem,
  InboxReason,
  InboxResponse,
  ReadPosition,
  SubscriptionResponse,
} from "../inbox/index.ts";
export type {
  ConnectedEvent,
  CookoutEvent,
  IdentityEvent,
  InboxItemEvent,
  MessageEvent,
  ReadPositionEvent,
} from "../events/index.ts";
export type { EventStream, WatchOptions } from "./lib/events.ts";
export type { ServerSentEvent } from "../http/client.ts";
export { CookoutError, type CookoutErrorCode, type Refusal, type UnknownErrorCode, refusalOf } from "./lib/errors.ts";

export type CookoutClientOptions = {
  /** The server's base URL, such as `https://cookout.example.com`. Default: `COOKOUT_URL`. */
  readonly url?: string;
  /**
   * The bearer token: an Identity token, or the agent session token `join` answered, to act as the agent for that
   * session. Default: `COOKOUT_TOKEN`. Not needed for the health check.
   */
  readonly token?: string;
  /** Where `COOKOUT_URL` and `COOKOUT_TOKEN` are read from. Default: the process's environment (none in a browser). */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** The agent tool running this process, such as `claude-code`, sent on every request: a human's token with it is refused with 403 `agent_as_human`, and messages posted record it. Default: with a token from `COOKOUT_TOKEN`, the tool `env` shows (`CLAUDECODE=1` for Claude Code, or the tool an `AI_AGENT` value names), unless `COOKOUT_ALLOW_HUMAN=1`. */
  readonly agentTool?: string;
};

export type CookoutClient = {
  /** `GET /v1/health`. Resolves when the server and its storage are usable. */
  readonly health: () => Promise<HealthResponse>;
  /** `GET /v1/whoami`: the identity behind this client's token. */
  readonly whoami: () => Promise<IdentityResponse>;
  /**
   * `POST /v1/session`: logs a human identity in to the web UI. The server answers with the identity and sets an
   * HttpOnly, SameSite=Strict session cookie, which a browser then sends instead of the token. An agent's token is
   * refused with 403 `human_only` (`details.kind` names its kind); no token with 401 `token_missing`.
   */
  readonly login: () => Promise<IdentityResponse>;
  /** `DELETE /v1/session`: clears the session cookie. */
  readonly logout: () => Promise<IdentityResponse>;
  /** `GET /v1/identities`: every identity, sorted by name; Deactivated ones only with `{ include: "deactivated" }`. */
  readonly listIdentities: (query?: ListIdentitiesQuery) => Promise<ListIdentitiesResponse>;
  /** Any human creates agents it owns; see `CreateIdentityRequest`. The token is shown this once. A name in use is 409. */
  readonly createIdentity: (request: CreateIdentityRequest) => Promise<IdentityWithTokenResponse>;
  /** Admin only. Issues a new token; the old one stops working at once. */
  readonly rotateToken: (name: string) => Promise<IdentityWithTokenResponse>;
  /**
   * `POST /v1/identities/:name/deactivate`: an admin deactivates anyone, a human their own agents (403 `not_owner`
   * otherwise). Every token it holds fails at once, and a human's agents are deactivated with it (`agents`). Its
   * messages and name stay; the name can't be created again. The last admin is 409 `last_admin`.
   */
  readonly deactivateIdentity: (name: string) => Promise<DeactivateIdentityResponse>;
  /**
   * `POST /v1/identities/:name/reactivate`: an admin reactivates anyone, a human their own agents. Answers a fresh
   * token, shown this once; old tokens stay dead. 409 `not_deactivated` if it isn't, or `owner_deactivated` for an
   * agent whose owner still is.
   */
  readonly reactivateIdentity: (name: string) => Promise<IdentityWithTokenResponse>;
  /** Admin only. Makes a human an admin and answers it; an admin stays one. An agent is 403 `human_only`. */
  readonly makeAdmin: (name: string) => Promise<IdentityResponse>;
  /** Admin only. Removes admin and answers the identity. The last admin keeps it (409 `last_admin`). */
  readonly removeAdmin: (name: string) => Promise<IdentityResponse>;
  /** `PUT`s (trimmed, 1–80 characters) or clears (`null`) a display name: its own, its owner's or an admin's call. */
  readonly setDisplayName: (name: string, displayName: string | null) => Promise<IdentityResponse>;
  /** `POST /v1/channels`: any identity can create a channel. A name in use is 409 `channel_exists`. */
  readonly createChannel: (request: CreateChannelRequest) => Promise<ChannelResponse>;
  /** `GET /v1/channels`: every channel, sorted by name. */
  readonly listChannels: () => Promise<ListChannelsResponse>;
  /** `GET /v1/channels?subscribed=true`: the channels the caller subscribes to, sorted by name. */
  readonly listSubscribedChannels: () => Promise<ListChannelsResponse>;
  /** `GET /v1/channels/:name`. A missing channel is 404 `channel_not_found`. */
  readonly getChannel: (name: string) => Promise<ChannelResponse>;
  /**
   * `DELETE /v1/channels/:name`, admin only: deletes the channel and everything in it, and answers it. A missing
   * channel is 404 `channel_not_found`. The name can be created again, as a new, empty channel.
   */
  readonly deleteChannel: (name: string) => Promise<ChannelResponse>;
  /**
   * `POST /v1/messages`: a top-level message, or a reply with `replyTo` (a reply to a reply joins the parent's thread).
   * A missing channel or message is 404; replying in another channel is 400 `reply_in_other_channel`.
   */
  readonly createMessage: (request: PostMessageRequest) => Promise<MessageResponse>;
  /**
   * `GET /v1/channels/:name/messages`: the channel's top-level messages, oldest first: the newest `limit` (default 50),
   * or those before `before`. Page back by passing the first message's ID as `before` while `hasMore` is true.
   */
  readonly listMessages: (channel: string, query?: ListMessagesQuery) => Promise<ListMessagesResponse>;
  /** `GET /v1/messages/:id/thread`: the thread holding the message, its top-level message and every reply in order. */
  readonly getThread: (messageId: MessageId) => Promise<ThreadResponse>;
  /**
   * `POST /v1/agent-session`, with an agent's Identity token (`as` must be its name; a human's is 403
   * `identity_kind`): issues an agent session token, which expires once unused for `idleExpiry` (default `7d`, at
   * most the server's `COOKOUT_MAX_IDLE_EXPIRY`, else 400 `idle_expiry_too_long`); each request sent with it moves
   * its expiry on. Make a client with it as `token` to act as the agent for this session. 409 `agent_session_live`
   * (with `details.expiresAt`) while the agent has a live one, unless `force`, which revokes that one at once.
   */
  readonly join: (request: JoinRequest) => Promise<AgentSessionResponse>;
  /**
   * `DELETE /v1/agent-session`: revokes the agent session token this client's token is, so another session can join
   * at once. With any other token, 400 `agent_session_required`. A revoked or expired agent session token gets 401
   * `agent_session_revoked` or `agent_session_expired` on every request.
   */
  readonly leave: () => Promise<LeaveResponse>;
  /**
   * `GET /v1/inbox`: what the caller hasn't read, oldest first, each message once with every reason it is there
   * (`followed-thread`, `mention`, `subscribed-channel`), its channel and its thread's top-level message. The
   * caller's own messages never appear. Reading it changes nothing.
   */
  readonly inbox: () => Promise<InboxResponse>;
  /**
   * `GET /v1/inbox/history`: a page of the caller's inbox history, newest first: every message in its inbox for at
   * least one reason as things stand now (current follows and subscriptions), read or not, each once with every
   * reason and `read`. The newest `limit` (default 50, 1–200), or those before `before`; page back by passing the
   * last item's message ID as `before` while `hasMore` is true. The caller's own messages never appear.
   */
  readonly inboxHistory: (query?: InboxHistoryQuery) => Promise<InboxHistoryResponse>;
  /**
   * `POST /v1/ack`: marks the message and everything before it in its thread (for a reply) or channel (for a
   * top-level message) as read. A read position never moves backwards. A missing message is 404 `message_not_found`.
   */
  readonly ack: (messageId: MessageId) => Promise<AckResponse>;
  /**
   * `PUT /v1/messages/:id/follow`: follows the thread holding the message, so its replies reach the inbox. Starting
   * a thread, replying in it and being mentioned in it follow it too.
   */
  readonly follow: (messageId: MessageId) => Promise<FollowResponse>;
  /** `DELETE /v1/messages/:id/follow`: stops following the thread until the caller next replies or is mentioned in it. */
  readonly unfollow: (messageId: MessageId) => Promise<FollowResponse>;
  /** `PUT /v1/channels/:name/subscription`: new top-level messages in the channel reach the inbox. */
  readonly subscribe: (channel: string) => Promise<SubscriptionResponse>;
  /** `DELETE /v1/channels/:name/subscription`: they stop reaching it. */
  readonly unsubscribe: (channel: string) => Promise<SubscriptionResponse>;
  /**
   * `GET /v1/events`: opens one Server-Sent Events stream, resolving once the server has accepted it. Iterate it for
   * each new inbox item (`inbox-item`) the moment another identity posts it (the caller's own posts never arrive), and
   * each new read position (`read-position`) the moment any session of the caller acks, so several sessions stay in
   * sync. With `allChannels`, it also sends every new message on every channel (`message`), as the web UI needs.
   * Each event is checked against the protocol (`bad_response` otherwise); an event type this SDK doesn't know, from
   * a newer server, is skipped. `close` drops the connection. Opened with an agent session token, the stream moves its
   * expiry on while open, and once the token is revoked (`leave`, or another session's `join --force`) the
   * iteration throws `agent_session_revoked` (status 200, the stream's). To pick up after a dropped connection, pass
   * the last message ID seen as `lastEventId`: the stream first replays the inbox items after it, then goes on live.
   * The server sends a heartbeat every 15 s, which `onHeartbeat` hears while the stream is being iterated. The
   * stream starts by telling `onConnected` the board's latest message ID (null before the first message): every
   * item sent live is newer, so resuming from it after a drop misses nothing.
   */
  readonly watch: (options?: WatchOptions) => Promise<EventStream>;
  /**
   * `POST /v1/commands` (admin only): registers a webhook command. Its handler identity is an agent with the
   * command's name, made unless an agent of that name exists. The secret deliveries are signed with is in the answer
   * this once. A name in use is 409 `command_exists`; a human's name is 409 `handler_not_agent`.
   */
  readonly addCommand: (request: AddCommandRequest) => Promise<CommandWithSecretResponse>;
  /** `GET /v1/commands`: every command, sorted by name, without its secret. */
  readonly listCommands: () => Promise<ListCommandsResponse>;
  /**
   * `POST /v1/commands/:name/calls`: calls a command. Data that breaks its JSON Schema is 400 `invalid_request`
   * with the schema errors in `details` (paths start at `data`), and nothing is posted. Otherwise the call is
   * posted in the channel as a top-level message by the caller with data `{ command, data }`, the caller follows
   * its thread, and the answer (202) comes without waiting for the handler. An unknown command is 404
   * `command_not_found`.
   */
  readonly callCommand: (name: string, request: CallCommandRequest) => Promise<CallCommandResponse>;
  /**
   * `POST /v1/commands/:name/secret` (admin only): issues the command a new secret in place of its old one, which
   * signs no delivery from then on, retries of earlier calls included. The new secret is in the answer this once. An
   * unknown command is 404 `command_not_found`.
   */
  readonly rotateCommandSecret: (name: string) => Promise<CommandWithSecretResponse>;
};

/**
 * Checks one Server-Sent Event from `GET /v1/events` against the protocol, for a reader that opens the stream itself
 * (a browser's `EventSource`). It answers the event, or `null` for an event type this SDK doesn't know; data that
 * doesn't match fails with `CookoutError` code `bad_response`.
 */
export const parseEvent: typeof eventOf = eventOf;

/** A client for the server at `url` with `token`, each defaulting to `COOKOUT_URL` and `COOKOUT_TOKEN`. Throws `CookoutError` code `url_missing` (status 0) when there is no URL. */
export function createCookoutClient(options: CookoutClientOptions = {}): CookoutClient {
  const server = connectionFor(options);
  return {
    ...identityCalls(server),
    ...channelCalls(server),
    ...messageCalls(server),
    ...agentSessionCalls(server),
    ...inboxCalls(server),
    ...eventCalls(server),
    ...commandCalls(server),
  };
}
