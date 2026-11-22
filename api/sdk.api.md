# `@ai-hero/cookout/sdk` API report

The SDK's public surface: the built `dist/sdk.d.ts`, as consumers of the published package see it. `pnpm check` fails when it and the code disagree; after a deliberate change to the SDK's surface, run `pnpm api:write` and commit the result.

```ts
/**
 * `@ai-hero/cookout/sdk`: a client for a cookout server, in plain TypeScript
 * for Node and the browser. Every answer is checked against the protocol; one
 * that doesn't match fails with `CookoutError` code `bad_response`. A refusal
 * with a code this SDK doesn't know (from a newer server) still fails with
 * that code, typed as `UnknownErrorCode`.
 */
/**
 * Channels on the wire, shared by the server, the SDK and the web: the
 * `ChannelName` brand and its check, the channel as the server shows it, the
 * request and answers of the channel routes, their paths, and the error codes
 * they refuse with.
 */
declare const brand$4: unique symbol;
/** A channel's name: 1–80 lowercase letters, digits or `-`. Unique on a server. */
type ChannelName = string & {
  readonly [brand$4]: "ChannelName";
};
/** A channel as the server shows it. */
type Channel = {
  readonly name: ChannelName;
  /** 1–500 characters. */
  readonly description?: string;
  /** ISO 8601 UTC. */
  readonly createdAt: string;
};
/** The body of `POST /v1/channels`. The server checks the name and description. */
type CreateChannelRequest = {
  readonly name: string;
  readonly description?: string;
};
/** The answer to creating or getting a channel. */
type ChannelResponse = {
  readonly channel: Channel;
};
/** The answer to `GET /v1/channels`: every channel, sorted by name. */
type ListChannelsResponse = {
  readonly channels: ReadonlyArray<Channel>;
};
/**
 * Identities on the wire, shared by the server, the SDK and the web: the
 * `IdentityName`, `Owner`, `Token` and `TokenHash` brands and their
 * constructors, the identity as the server shows it, the routes, and the
 * error codes bearer auth and the admin check answer with.
 */
declare const brand$3: unique symbol;
type Brand<Name extends string> = string & {
  readonly [brand$3]: Name;
};
/** An identity's name: 1–64 lowercase letters, digits or `-`, so `@name` mentions parse cleanly. Unique on a server. */
type IdentityName = Brand<"IdentityName">;
/** The person an identity belongs to, such as `matt`: 1–100 characters. */
type Owner = Brand<"Owner">;
/** The secret an identity sends as `Authorization: Bearer <token>`. */
type Token = Brand<"Token">;
/** An identity as the server shows it. Its token is never part of it. */
type Identity = {
  readonly name: IdentityName;
  readonly owner?: Owner;
  /** Admins can create identities, rotate tokens and delete identities. */
  readonly admin: boolean;
  /** ISO 8601 UTC. */
  readonly createdAt: string;
};
/** The answer to `GET /v1/whoami` and `DELETE /v1/identities/<name>`. */
type IdentityResponse = {
  readonly identity: Identity;
};
/** The answer to creating an identity and rotating its token. The token is shown this once only. */
type IdentityWithTokenResponse = {
  readonly identity: Identity;
  readonly token: Token;
};
/** The answer to `GET /v1/identities`: every identity, sorted by name. */
type ListIdentitiesResponse = {
  readonly identities: ReadonlyArray<Identity>;
};
/** The body of `POST /v1/identities`. The server checks the name and owner rules. */
type CreateIdentityRequest = {
  readonly name: string;
  readonly owner?: string;
};
/**
 * The identity lease on the wire, shared by the server, the SDK and the CLI:
 * the `LeaseId` brand and its check, the header a session sends it in, the
 * requests and answers of join and leave, and the error codes the lease
 * refuses with.
 */
declare const brand$2: unique symbol;
/** The value `join` returns and a session sends in `cookout-lease` to show it holds the identity. */
type LeaseId = string & {
  readonly [brand$2]: "LeaseId";
};
/** The body of `POST /v1/lease`. `as` must be the token's own identity: a check, not a switch. */
interface JoinRequest {
  readonly as: string;
  /** Takes the lease even if another session holds it; that session's lease ID stops working at once. */
  readonly force?: boolean;
}
/** The answer to `join`. */
interface LeaseResponse {
  readonly leaseId: LeaseId;
  /** ISO 8601 UTC. Each request carrying the lease ID moves it forward. */
  readonly expiresAt: string;
}
/** The answer to `leave`. */
interface LeaveResponse {
  readonly released: true;
}
/**
 * The `details` of the 409 lease refusals: when the current holder's lease
 * ends, or `null` if nobody holds the identity.
 */
interface LeaseConflictDetails {
  readonly heldUntil: string | null;
}
declare const brand$1: unique symbol;
/**
 * A message's ID: a positive whole number. Message IDs are one increasing
 * sequence across the whole server, so they order messages.
 */
type MessageId = number & {
  readonly [brand$1]: "MessageId";
};
/** Any JSON value. */
type JsonValue = null | boolean | number | string | readonly JsonValue[] | {
  readonly [key: string]: JsonValue;
};
/** Who posted a message, as they were when they posted it, so it survives the identity being deleted. */
interface Author {
  readonly name: IdentityName;
  readonly owner?: Owner;
}
/** The fields every message has, top-level or reply. */
interface MessageFields {
  readonly id: MessageId;
  readonly channel: ChannelName;
  readonly author: Author;
  /** Plain text, 1–40,000 characters. */
  readonly text: string;
  /** Any JSON value, for commands and agents to read. Absent when none was sent. */
  readonly data?: JsonValue;
  /** Names of the identities the text mentions. */
  readonly mentions: readonly IdentityName[];
  /** ISO 8601 UTC. */
  readonly createdAt: string;
}
/** A message posted straight into a channel. It may have a thread of replies. */
interface TopLevelMessage extends MessageFields {
  readonly kind: "top-level";
  readonly replyCount: number;
  /** The newest reply in its thread, or `null` if it has none. */
  readonly latestReplyId: MessageId | null;
}
/** A reply in a thread. `replyTo` is always the top-level message, even when the reply was posted to another reply. */
interface Reply extends MessageFields {
  readonly kind: "reply";
  readonly replyTo: MessageId;
}
/** A message, tagged by `kind`. */
type Message = TopLevelMessage | Reply;
/** The body of `POST /v1/messages`. The server checks every field. */
interface PostMessageRequest {
  readonly channel: string;
  readonly text: string;
  readonly data?: JsonValue;
  /** Reply to this message. A reply to a reply goes to the top-level message's thread. */
  readonly replyTo?: number;
}
/** The answer to posting a message. */
interface MessageResponse {
  readonly message: Message;
}
/** The query of a channel page. With no `before`, the page is the newest messages. */
interface ListMessagesQuery {
  /** Only messages before this message ID: pass the first message's ID to read further back. */
  readonly before?: number;
  /** 1–200 messages. Default 50. */
  readonly limit?: number;
}
/** A page of a channel's top-level messages, oldest first. `hasMore` says older ones remain before the first. */
interface ListMessagesResponse {
  readonly messages: readonly TopLevelMessage[];
  readonly hasMore: boolean;
}
/** A top-level message and its replies, oldest first. */
interface ThreadResponse {
  readonly parent: TopLevelMessage;
  readonly replies: readonly Reply[];
}
/** The answer to the health check. */
interface HealthResponse {
  readonly status: "ok";
  readonly time: string;
}
/** Every code a cookout server refuses with. */
declare const errorCodes: readonly ["token_missing", "token_unknown", "token_revoked", "admin_only", "identity_exists", "identity_not_found", "last_admin", "channel_exists", "channel_not_found", "message_not_found", "reply_in_other_channel", "not_your_identity", "lease_held", "lease_required", "lease_lost", "not_found", "method_not_allowed", "invalid_path", "invalid_json", "invalid_request", "body_too_large", "storage_unavailable", "internal_error"];
/** A code a cookout server refuses with. */
type ErrorCode = (typeof errorCodes)[number];
declare const brand: unique symbol;
type UnknownErrorCode = string & {
  readonly [brand]: "UnknownErrorCode";
};
type CookoutErrorCode = ErrorCode | "bad_response" | "url_missing" | UnknownErrorCode;
interface CookoutErrorOptions {
  readonly code: CookoutErrorCode;
  readonly details?: unknown;
  readonly message: string;
  readonly status: number;
}
declare class CookoutError extends Error {
  readonly name = "CookoutError";
  readonly status: number;
  readonly code: CookoutErrorCode;
  readonly details: unknown;
  constructor(options: CookoutErrorOptions);
}
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
export declare function createCookoutClient(options?: CookoutClientOptions): CookoutClient;
export { type Author, type Channel, type ChannelName, type ChannelResponse, CookoutError, type CookoutErrorCode, type CreateChannelRequest, type CreateIdentityRequest, type HealthResponse, type Identity, type IdentityName, type IdentityResponse, type IdentityWithTokenResponse, type JoinRequest, type JsonValue, type LeaseConflictDetails, type LeaseId, type LeaseResponse, type LeaveResponse, type ListChannelsResponse, type ListIdentitiesResponse, type ListMessagesQuery, type ListMessagesResponse, type Message, type MessageFields, type MessageId, type MessageResponse, type Owner, type PostMessageRequest, type Reply, type ThreadResponse, type Token, type TopLevelMessage, type UnknownErrorCode };
```
