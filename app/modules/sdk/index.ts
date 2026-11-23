/**
 * `@ai-hero/cookout/sdk`: a client for a cookout server, in plain TypeScript
 * for Node and the browser. Every answer is checked against the protocol; one
 * that doesn't match fails with `CookoutError` code `bad_response`. A refusal
 * with a code this SDK doesn't know (from a newer server) still fails with
 * that code, typed as `UnknownErrorCode`.
 */
import type { AckResponse, FollowResponse, InboxResponse, SubscriptionResponse } from "./lib/inbox.ts";
import type {
  AddCommandRequest,
  CallCommandRequest,
  CallCommandResponse,
  CommandWithSecretResponse,
  ListCommandsResponse,
} from "./lib/commands.ts";
import type { ChannelResponse, CreateChannelRequest, ListChannelsResponse } from "../channels/index.ts";
import type {
  CreateIdentityRequest,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListIdentitiesResponse,
} from "../identities/index.ts";
import type { EventStream, WatchOptions } from "./lib/events.ts";
import type { JoinRequest, LeaseId, LeaseResponse, LeaveResponse } from "./lib/leases.ts";
import type {
  ListMessagesQuery,
  ListMessagesResponse,
  MessageId,
  MessageResponse,
  PostMessageRequest,
  ThreadResponse,
} from "./lib/messages.ts";
import { channelPath, channelsPath } from "../channels/index.ts";
import { connectionFor, getJson, send } from "./lib/request.ts";
import { eventCalls, eventOf } from "./lib/events.ts";
import { identitiesPath, identityPath, identityTokenPath, sessionPath, whoamiPath } from "../identities/index.ts";
import {
  isChannelResponse,
  isHealthResponse,
  isIdentityResponse,
  isIdentityWithTokenResponse,
  isListChannelsResponse,
  isListIdentitiesResponse,
} from "./lib/generated/validators.js";
import type { HealthResponse } from "../http/index.ts";
import { commandCalls } from "./lib/commands.ts";
import { healthPath } from "../http/index.ts";
import { inboxCalls } from "./lib/inbox.ts";
import { leaseCalls } from "./lib/leases.ts";
import { messageCalls } from "./lib/messages.ts";

export type {
  Channel,
  ChannelName,
  ChannelResponse,
  CreateChannelRequest,
  ListChannelsResponse,
} from "../channels/index.ts";
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
export type { HealthResponse } from "../http/index.ts";
export type { IsoTime } from "../time/index.ts";
export type {
  AgentIdentity,
  CreateIdentityRequest,
  HumanIdentity,
  Identity,
  IdentityKind,
  IdentityName,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListIdentitiesResponse,
  Owner,
  Token,
} from "../identities/index.ts";
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
  JoinRequest,
  LeaseConflictDetails,
  LeaseId,
  LeaseResponse,
  LeaveResponse,
} from "../leases/index.ts";
export type {
  AckRequest,
  AckResponse,
  FollowResponse,
  InboxItem,
  InboxReason,
  InboxResponse,
  ReadPosition,
  SubscriptionResponse,
} from "../inbox/index.ts";
export type { CookoutEvent, InboxItemEvent, MessageEvent, ReadPositionEvent } from "../events/index.ts";
export type { EventStream, WatchOptions } from "./lib/events.ts";
export type { ServerSentEvent } from "../http/client.ts";
export { CookoutError, type CookoutErrorCode, type UnknownErrorCode } from "./lib/errors.ts";

export type CookoutClientOptions = {
  /** The server's base URL, such as `https://cookout.example.com`. Default: `COOKOUT_URL`. */
  readonly url?: string;
  /** The bearer token. Default: `COOKOUT_TOKEN`. Not needed for the health check. */
  readonly token?: string;
  /** Where `COOKOUT_URL` and `COOKOUT_TOKEN` are read from. Default: the process's environment (none in a browser). */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** A lease ID from an earlier `join` (the CLI keeps it in its lease-state file). The client sends it on every request, which renews the lease. */
  readonly leaseId?: LeaseId;
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
  /** `GET /v1/identities`: every identity with its kind and owner, sorted by name. A command's handler has `handler: true`. */
  readonly listIdentities: () => Promise<ListIdentitiesResponse>;
  /** Admin only. The token in the answer is shown this once. A name in use is 409 `identity_exists`. */
  readonly createIdentity: (request: CreateIdentityRequest) => Promise<IdentityWithTokenResponse>;
  /** Admin only. Issues a new token; the old one stops working at once. */
  readonly rotateToken: (name: string) => Promise<IdentityWithTokenResponse>;
  /** Admin only. Removes the identity; its token stops working. The last admin can't be deleted (409 `last_admin`). */
  readonly deleteIdentity: (name: string) => Promise<IdentityResponse>;
  /** `POST /v1/channels`: any identity can create a channel. A name in use is 409 `channel_exists`. */
  readonly createChannel: (request: CreateChannelRequest) => Promise<ChannelResponse>;
  /** `GET /v1/channels`: every channel, sorted by name. */
  readonly listChannels: () => Promise<ListChannelsResponse>;
  /** `GET /v1/channels/:name`. A missing channel is 404 `channel_not_found`. */
  readonly getChannel: (name: string) => Promise<ChannelResponse>;
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
   * `POST /v1/lease`: takes the lease on the token's identity (`as` must be its name). From then on this client sends
   * the lease ID on every request, renewing it. 409 `lease_held` (with `details.heldUntil`) if another session holds
   * it, unless `force`, which takes it over.
   */
  readonly join: (request: JoinRequest) => Promise<LeaseResponse>;
  /**
   * `DELETE /v1/lease`: releases this client's lease, so another session can join at once. Needs the lease: 409
   * `lease_required` without one, `lease_lost` if it is no longer live. After a `lease_lost` the client stops sending it.
   */
  readonly leave: () => Promise<LeaveResponse>;
  /**
   * `GET /v1/inbox`: what the caller hasn't read, oldest first, each message once with every reason it is there
   * (`followed-thread`, `mention`, `subscribed-channel`), its channel and its thread's top-level message. The
   * caller's own messages never appear. Reading it changes nothing.
   */
  readonly inbox: () => Promise<InboxResponse>;
  /**
   * `POST /v1/ack`: marks the message and everything before it in its thread (for a reply) or channel (for a
   * top-level message) as read. A read position never moves backwards. Sent without a lease ID, it is allowed only
   * while nobody holds the lease on the caller's identity (409 `lease_required` otherwise); a stale lease ID is 409
   * `lease_lost`. A missing message is 404 `message_not_found`.
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
   * a newer server, is skipped. `close` drops the connection. For an agent identity the stream carries the held
   * lease ID and keeps the lease alive while open; a stale one is refused with 409 `lease_lost`, and if another
   * session takes the lease over (`join --force`) the iteration throws `lease_lost` (status 200, the stream's) and
   * the client drops the lease. A human identity watches with no lease. To pick up after a dropped connection, pass
   * the last message ID seen as `lastEventId`: the stream first replays the inbox items after it, then goes on live.
   * The server sends a heartbeat every 15 s, which `onHeartbeat` hears while the stream is being iterated.
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
};

/**
 * Checks one Server-Sent Event from `GET /v1/events` against the protocol, for a reader that opens the stream itself
 * (a browser's `EventSource`). It answers the event, or `null` for an event type this SDK doesn't know; data that
 * doesn't match fails with `CookoutError` code `bad_response`.
 */
export const parseEvent: typeof eventOf = eventOf;

/**
 * A client for the server at `url` with `token`, each defaulting to
 * `COOKOUT_URL` and `COOKOUT_TOKEN`. Throws `CookoutError` code `url_missing`
 * (status 0) when there is no URL.
 */
export function createCookoutClient(options: CookoutClientOptions = {}): CookoutClient {
  const server = connectionFor(options);
  return {
    createChannel: (body) => send(server, { body, isExpected: isChannelResponse, method: "POST", path: channelsPath }),
    createIdentity: (body) =>
      send(server, { body, isExpected: isIdentityWithTokenResponse, method: "POST", path: identitiesPath }),
    deleteIdentity: (name) =>
      send(server, { isExpected: isIdentityResponse, method: "DELETE", params: { name }, path: identityPath }),
    getChannel: (name) =>
      send(server, { isExpected: isChannelResponse, method: "GET", params: { name }, path: channelPath }),
    health: () => getJson(server, healthPath, isHealthResponse),
    listChannels: () => getJson(server, channelsPath, isListChannelsResponse),
    listIdentities: () => getJson(server, identitiesPath, isListIdentitiesResponse),
    login: async () => {
      const loggedIn = await send(server, { isExpected: isIdentityResponse, method: "POST", path: sessionPath });
      return loggedIn;
    },
    logout: async () => {
      const loggedOut = await send(server, { isExpected: isIdentityResponse, method: "DELETE", path: sessionPath });
      return loggedOut;
    },
    rotateToken: (name) =>
      send(server, {
        isExpected: isIdentityWithTokenResponse,
        method: "POST",
        params: { name },
        path: identityTokenPath,
      }),
    whoami: () => getJson(server, whoamiPath, isIdentityResponse),
    ...messageCalls(server),
    ...leaseCalls(server),
    ...inboxCalls(server),
    ...eventCalls(server),
    ...commandCalls(server),
  };
}
