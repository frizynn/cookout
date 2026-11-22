/**
 * `@ai-hero/cookout/sdk`: a client for a cookout server, in plain TypeScript
 * for Node and the browser. Every answer is checked against the protocol; one
 * that doesn't match fails with `CookoutError` code `bad_response`.
 */
import type { ChannelResponse, CreateChannelRequest, ListChannelsResponse } from "../channels/index.ts";
import { channelPath, channelsPath } from "../channels/index.ts";
import { readCookoutConnection } from "../config/index.ts";
import type { HealthResponse } from "../http/index.ts";
import { healthPath } from "../http/index.ts";
import type {
  CreateIdentityRequest,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListIdentitiesResponse,
} from "../identities/index.ts";
import { identitiesPath, identityPath, identityTokenPath, whoamiPath } from "../identities/index.ts";
import { CookoutError } from "./lib/errors.ts";
import { getJson, send } from "./lib/request.ts";
import {
  isChannelResponse,
  isHealthResponse,
  isIdentityResponse,
  isIdentityWithTokenResponse,
  isListChannelsResponse,
  isListIdentitiesResponse,
} from "./lib/generated/validators.js";

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
export { CookoutError, type CookoutErrorCode } from "./lib/errors.ts";

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
};

/**
 * A client for the server at `url` with `token`, each defaulting to
 * `COOKOUT_URL` and `COOKOUT_TOKEN`. Throws `CookoutError` code `url_missing`
 * (status 0) when there is no URL.
 */
export function createCookoutClient(options: CookoutClientOptions = {}): CookoutClient {
  const connection = { ...readCookoutConnection(options.env), ...options };
  const url = connection.url ?? "";
  if (url === "") {
    throw new CookoutError({
      status: 0,
      code: "url_missing",
      message: "Set COOKOUT_URL to the cookout server's address.",
    });
  }
  const server = { ...connection, url };
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
  };
}
