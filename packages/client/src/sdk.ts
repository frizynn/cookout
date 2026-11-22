import type { z } from "zod";
import type {
  ChannelResponse,
  CreateChannelRequest,
  CreateIdentityRequest,
  HealthResponse,
  IdentityResponse,
  IdentityWithTokenResponse,
  JoinRequest,
  LeaseResponse,
  LeaveResponse,
  ListChannelsResponse,
  ListIdentitiesResponse,
  ListMessagesQuery,
  ListMessagesResponse,
  MessageId,
  MessageResponse,
  PostMessageRequest,
  ThreadResponse,
} from "@ai-hero/cookout-protocol";
import {
  leaseHeader,
  leasePath,
  leaseResponseSchema,
  leaveResponseSchema,
  channelMessagesPath,
  channelPath,
  channelResponseSchema,
  channelsPath,
  listChannelsResponseSchema,
  listMessagesResponseSchema,
  messageResponseSchema,
  messagesPath,
  threadPath,
  threadResponseSchema,
  errorResponseSchema,
  healthPath,
  healthResponseSchema,
  identitiesPath,
  identityPath,
  identityResponseSchema,
  identityTokenPath,
  identityWithTokenResponseSchema,
  listIdentitiesResponseSchema,
  whoamiPath,
} from "@ai-hero/cookout-protocol";

export type CookoutClientOptions = {
  /** The server's base URL, e.g. `https://cookout.example.com`. Default: `COOKOUT_URL`. */
  url?: string;
  /** The bearer token. Default: `COOKOUT_TOKEN`. Not needed for the health check. */
  token?: string;
  /** Where `COOKOUT_URL` and `COOKOUT_TOKEN` are read from. Default `process.env`. */
  env?: Record<string, string | undefined>;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /**
   * A lease ID from an earlier `join` (the CLI keeps it in its state file).
   * The client sends it on every request, which renews the lease.
   */
  leaseId?: string;
};

export type CookoutClient = {
  /** `GET /v1/health`. Resolves when the server and its storage are usable. */
  health(): Promise<HealthResponse>;
  /** `GET /v1/whoami`: the identity behind this client's token. */
  whoami(): Promise<IdentityResponse>;
  /** `GET /v1/identities`: every identity and its owner, sorted by name. */
  listIdentities(): Promise<ListIdentitiesResponse>;
  /** Admin only. The token in the answer is shown this once. */
  createIdentity(request: CreateIdentityRequest): Promise<IdentityWithTokenResponse>;
  /** Admin only. Issues a new token; the old one stops working at once. */
  rotateToken(name: string): Promise<IdentityWithTokenResponse>;
  /** Admin only. Removes the identity; its token stops working. */
  deleteIdentity(name: string): Promise<IdentityResponse>;
  /** Any identity can create a channel. A name already in use is 409 `channel_exists`. */
  createChannel(request: CreateChannelRequest): Promise<ChannelResponse>;
  /** Every channel, sorted by name. */
  listChannels(): Promise<ListChannelsResponse>;
  getChannel(name: string): Promise<ChannelResponse>;
  /** Posts a top-level message, or a reply with `replyTo` (a reply to a reply joins the parent's thread). */
  postMessage(request: PostMessageRequest): Promise<MessageResponse>;
  /**
   * A page of the channel's top-level messages, oldest first: the newest
   * `limit` (default 50), or those before `before`. Page back by passing the
   * first message's ID as `before` while `hasMore` is true.
   */
  listMessages(channel: string, query?: ListMessagesQuery): Promise<ListMessagesResponse>;
  /** The thread holding the message: its top-level message and every reply, in order. */
  getThread(messageId: MessageId): Promise<ThreadResponse>;
  /**
   * Takes the lease on the token's identity (`as` must be its name). From
   * then on this client sends the lease ID on every request, renewing it.
   * 409 `lease_held` (with `details.heldUntil`) if another session holds it,
   * unless `force`, which takes it over.
   */
  join(request: JoinRequest): Promise<LeaseResponse>;
  /** Releases this client's lease, so another session can join at once. Needs the lease (409 `lease_required`). */
  leave(): Promise<LeaveResponse>;
};

/**
 * An error from the server (its `{ error: { code, message, details? } }`
 * body), or `bad_response` when the server's answer isn't what the protocol
 * says. `url_missing` (status 0) means no URL was given and `COOKOUT_URL` is unset.
 */
export class CookoutError extends Error {
  override readonly name = "CookoutError";
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(options: { status: number; code: string; message: string; details?: unknown }) {
    super(options.message);
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export function createCookoutClient(options: CookoutClientOptions = {}): CookoutClient {
  const env = options.env ?? process.env;
  const url = options.url ?? env["COOKOUT_URL"];
  if (url === undefined || url === "") {
    throw new CookoutError({ status: 0, code: "url_missing", message: "Set COOKOUT_URL to the cookout server's address." });
  }
  const token = options.token ?? (env["COOKOUT_TOKEN"] === "" ? undefined : env["COOKOUT_TOKEN"]);
  const baseUrl = url.replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;
  /** Kept after a 409 `lease_lost`, so every later request says so until the session joins again. */
  let leaseId = options.leaseId;

  async function request<Schema extends z.ZodType>(
    method: string,
    path: string,
    responseSchema: Schema,
    body?: unknown,
  ): Promise<z.infer<Schema>> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (token !== undefined) headers["authorization"] = `Bearer ${token}`;
    if (leaseId !== undefined) headers[leaseHeader] = leaseId;
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await doFetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    let json: unknown;
    try {
      json = text === "" ? undefined : JSON.parse(text);
    } catch {
      json = undefined;
    }

    if (!response.ok) {
      const parsed = errorResponseSchema.safeParse(json);
      if (parsed.success) {
        throw new CookoutError({ status: response.status, ...parsed.data.error });
      }
      throw new CookoutError({
        status: response.status,
        code: "bad_response",
        message: `${method} ${path} failed with ${response.status} and no error body.`,
        details: text,
      });
    }

    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) {
      throw new CookoutError({
        status: response.status,
        code: "bad_response",
        message: `${method} ${path} returned a body that doesn't match the protocol.`,
        details: parsed.error.issues,
      });
    }
    return parsed.data;
  }

  return {
    health: () => request("GET", healthPath, healthResponseSchema),
    whoami: () => request("GET", whoamiPath, identityResponseSchema),
    listIdentities: () => request("GET", identitiesPath, listIdentitiesResponseSchema),
    createIdentity: (body) =>
      request("POST", identitiesPath, identityWithTokenResponseSchema, body),
    rotateToken: (name) => request("POST", identityTokenPath(name), identityWithTokenResponseSchema),
    deleteIdentity: (name) => request("DELETE", identityPath(name), identityResponseSchema),
    createChannel: (body) => request("POST", channelsPath, channelResponseSchema, body),
    listChannels: () => request("GET", channelsPath, listChannelsResponseSchema),
    getChannel: (name) => request("GET", channelPath(name), channelResponseSchema),
    postMessage: (body) => request("POST", messagesPath, messageResponseSchema, body),
    listMessages: (channel, query = {}) => {
      const search = new URLSearchParams();
      if (query.before !== undefined) search.set("before", String(query.before));
      if (query.limit !== undefined) search.set("limit", String(query.limit));
      const suffix = search.size === 0 ? "" : `?${search.toString()}`;
      return request("GET", `${channelMessagesPath(channel)}${suffix}`, listMessagesResponseSchema);
    },
    getThread: (messageId) => request("GET", threadPath(messageId), threadResponseSchema),
    join: async (body) => {
      const lease = await request("POST", leasePath, leaseResponseSchema, body);
      leaseId = lease.leaseId;
      return lease;
    },
    leave: async () => {
      const left = await request("DELETE", leasePath, leaveResponseSchema);
      leaseId = undefined;
      return left;
    },
  };
}
