/**
 * `@ai-hero/cookout/sdk`: a client for a cookout server, in plain TypeScript
 * for Node and the browser. Every answer is checked against the protocol; one
 * that doesn't match fails with `CookoutError` code `bad_response`. A refusal
 * with a code this SDK doesn't know (from a newer server) still fails with
 * that code, typed as `UnknownErrorCode`.
 */
import type { AckResponse, FollowResponse, InboxResponse, SubscriptionResponse } from "./lib/inbox.ts";
import type { ChannelResponse, CreateChannelRequest, ListChannelsResponse } from "../channels/index.ts";
import type {
  CreateIdentityRequest,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListIdentitiesResponse,
} from "../identities/index.ts";
import type { JoinRequest, LeaseId, LeaseResponse, LeaveResponse } from "../leases/index.ts";
import type {
  ListMessagesQuery,
  ListMessagesResponse,
  MessageId,
  MessageResponse,
  PostMessageRequest,
  ThreadResponse,
} from "../messages/index.ts";
import { channelPath, channelsPath } from "../channels/index.ts";
import { connectionFor, getJson, send } from "./lib/request.ts";
import { identitiesPath, identityPath, identityTokenPath, whoamiPath } from "../identities/index.ts";
import {
  isChannelResponse,
  isHealthResponse,
  isIdentityResponse,
  isIdentityWithTokenResponse,
  isListChannelsResponse,
  isListIdentitiesResponse,
} from "./lib/generated/validators.js";
import type { HealthResponse } from "../http/index.ts";
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
  /** `GET /v1/identities`: every identity with its kind and owner, sorted by name. */
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
};

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
  };
}
