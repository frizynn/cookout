# `@ai-hero/cookout/sdk` API report

The SDK's public surface: the built `dist/sdk.d.ts`, as consumers of the published package see it. `pnpm check` fails when it and the code disagree; after a deliberate change to the SDK's surface, run `pnpm api:write` and commit the result.

```ts
/**
 * `@ai-hero/cookout/sdk`: a client for a cookout server, in plain TypeScript
 * for Node and the browser. Every answer is checked against the protocol; one
 * that doesn't match fails with `CookoutError` code `bad_response`.
 */
/**
 * Channels on the wire, shared by the server, the SDK and the web: the
 * `ChannelName` brand and its check, the channel as the server shows it, the
 * request and answers of the channel routes, their paths, and the error codes
 * they refuse with.
 */
declare const brand$1: unique symbol;
/** A channel's name: 1–80 lowercase letters, digits or `-`. Unique on a server. */
type ChannelName = string & {
  readonly [brand$1]: "ChannelName";
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
type HealthResponse = {
  readonly status: "ok";
  readonly time: string;
};
declare const errorCodes: readonly ["token_missing", "token_unknown", "token_revoked", "admin_only", "channel_exists", "channel_not_found", "not_found", "method_not_allowed", "invalid_path", "invalid_json", "invalid_request", "body_too_large", "storage_unavailable", "internal_error"];
type ErrorCode = (typeof errorCodes)[number];
/**
 * Identities on the wire, shared by the server, the SDK and the web: the
 * `IdentityName`, `Owner`, `Token` and `TokenHash` brands and their
 * constructors, the identity as the server shows it, the routes, and the
 * error codes bearer auth and the admin check answer with.
 */
declare const brand: unique symbol;
type Brand<Name extends string> = string & {
  readonly [brand]: Name;
};
/** An identity's name: 1–64 lowercase letters, digits or `-`, so `@name` mentions parse cleanly. Unique on a server. */
type IdentityName = Brand<"IdentityName">;
/** The person an identity belongs to, such as `matt`: 1–100 characters. */
type Owner = Brand<"Owner">;
/** An identity as the server shows it. Its token is never part of it. */
type Identity = {
  readonly name: IdentityName;
  readonly owner?: Owner;
  /** Admins can create identities, rotate tokens and delete identities. */
  readonly admin: boolean;
  /** ISO 8601 UTC. */
  readonly createdAt: string;
};
/** The answer to `GET /v1/whoami`. */
type IdentityResponse = {
  readonly identity: Identity;
};
type CookoutErrorCode = ErrorCode | "bad_response" | "url_missing";
export declare class CookoutError extends Error {
  readonly name = "CookoutError";
  readonly status: number;
  readonly code: CookoutErrorCode;
  readonly details: unknown;
  constructor(options: {
    status: number;
    code: CookoutErrorCode;
    message: string;
    details?: unknown;
  });
}
export type CookoutClientOptions = {
  /** The server's base URL, such as `https://cookout.example.com`. Default: `COOKOUT_URL`. */
  readonly url?: string;
  /** The bearer token. Default: `COOKOUT_TOKEN`. Not needed for the health check. */
  readonly token?: string;
  /** Where `COOKOUT_URL` and `COOKOUT_TOKEN` are read from. Default: the process's environment (none in a browser). */
  readonly env?: Readonly<Record<string, string | undefined>>;
};
export type CookoutClient = {
  /** `GET /v1/health`. Resolves when the server and its storage are usable. */
  readonly health: () => Promise<HealthResponse>;
  /** `GET /v1/whoami`: the identity behind this client's token. */
  readonly whoami: () => Promise<IdentityResponse>;
  /** `POST /v1/channels`: any identity can create a channel. A name in use is 409 `channel_exists`. */
  readonly createChannel: (request: CreateChannelRequest) => Promise<ChannelResponse>;
  /** `GET /v1/channels`: every channel, sorted by name. */
  readonly listChannels: () => Promise<ListChannelsResponse>;
  /** `GET /v1/channels/:name`. A missing channel is 404 `channel_not_found`. */
  readonly getChannel: (name: string) => Promise<ChannelResponse>;
};
/**
 * A client for the server at `url` with `token`, each defaulting to
 * `COOKOUT_URL` and `COOKOUT_TOKEN`. Throws `CookoutError` code `url_missing`
 * (status 0) when there is no URL.
 */
export declare function createCookoutClient(options?: CookoutClientOptions): CookoutClient;
export type { Channel, ChannelName, ChannelResponse, CookoutErrorCode, CreateChannelRequest, HealthResponse, Identity, IdentityName, IdentityResponse, ListChannelsResponse, Owner };
```
