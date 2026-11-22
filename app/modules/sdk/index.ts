/**
 * `@ai-hero/cookout/sdk`: a client for a cookout server, in plain TypeScript
 * for Node and the browser. Every answer is checked against the protocol; one
 * that doesn't match fails with `CookoutError` code `bad_response`. A refusal
 * with a code this SDK doesn't know (from a newer server) still fails with
 * that code, typed as `UnknownErrorCode`.
 */
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
export type {
  CreateIdentityRequest,
  Identity,
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
  /** `GET /v1/identities`: every identity and its owner, sorted by name. */
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
};

/**
 * A client for the server at `url` with `token`, each defaulting to
 * `COOKOUT_URL` and `COOKOUT_TOKEN`. Throws `CookoutError` code `url_missing`
 * (status 0) when there is no URL.
 */
export function createCookoutClient(options: CookoutClientOptions = {}): CookoutClient {
  const server = connectionFor(options);
  return {
    health: () => getJson(server, healthPath, isHealthResponse),
    whoami: () => getJson(server, whoamiPath, isIdentityResponse),
    listIdentities: () => getJson(server, identitiesPath, isListIdentitiesResponse),
    createIdentity: (body) =>
      send(server, { method: "POST", path: identitiesPath, body, isExpected: isIdentityWithTokenResponse }),
    rotateToken: (name) =>
      send(server, {
        method: "POST",
        path: identityTokenPath,
        params: { name },
        isExpected: isIdentityWithTokenResponse,
      }),
    deleteIdentity: (name) =>
      send(server, { method: "DELETE", path: identityPath, params: { name }, isExpected: isIdentityResponse }),
    createChannel: (body) => send(server, { method: "POST", path: channelsPath, body, isExpected: isChannelResponse }),
    listChannels: () => getJson(server, channelsPath, isListChannelsResponse),
    getChannel: (name) =>
      send(server, { method: "GET", path: channelPath, params: { name }, isExpected: isChannelResponse }),
    ...messageCalls(server),
    ...leaseCalls(server),
  };
}
