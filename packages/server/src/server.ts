import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type {
  Channel,
  ChannelResponse,
  ErrorResponse,
  HealthResponse,
  Identity,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListChannelsResponse,
  ListIdentitiesResponse,
  ListMessagesResponse,
  MessageResponse,
  NewMessage,
  StorageAdapter,
  ThreadResponse,
} from "@ai-hero/cookout-protocol";
import {
  channelResponseSchema,
  channelsPath,
  createChannelRequestSchema,
  createIdentityRequestSchema,
  errorResponseSchema,
  healthPath,
  healthResponseSchema,
  identitiesPath,
  identityResponseSchema,
  identityWithTokenResponseSchema,
  listChannelsResponseSchema,
  listIdentitiesResponseSchema,
  listMessagesQuerySchema,
  listMessagesResponseSchema,
  messageResponseSchema,
  messagesPath,
  postMessageRequestSchema,
  threadResponseSchema,
  whoamiPath,
} from "@ai-hero/cookout-protocol";
import { hashToken } from "./tokens.ts";

/** Where the server reads the time. Tests pass a fake one. */
export type Clock = { now(): Date };

export type ServerOptions = {
  storage: StorageAdapter;
  clock: Clock;
  /** Makes a new random token (at least 256 bits). Start-up passes `randomToken`. */
  newToken: () => string;
  /** 0 picks a free port. */
  port: number;
  /** Default `0.0.0.0`. */
  host?: string;
};

export type RunningServer = {
  /** Base URL, e.g. `http://127.0.0.1:54321`. */
  url: string;
  /**
   * On first boot (a store with no identities) the server makes the `admin`
   * identity, and this is its token. Shown this once; `undefined` on later boots.
   */
  adminToken: string | undefined;
  /** Stops accepting requests and closes open connections. Doesn't close storage. */
  close(): Promise<void>;
};

/** The name of the admin identity made on first boot. */
const firstAdminName = "admin";
/** Request bodies larger than this are refused. */
const maxBodyBytes = 1024 * 1024;

/** Thrown by a handler to answer with an error body. */
class HttpError extends Error {
  readonly status: number;
  readonly error: ErrorResponse["error"];

  constructor(status: number, error: ErrorResponse["error"]) {
    super(error.message);
    this.status = status;
    this.error = error;
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function sendError(response: ServerResponse, status: number, error: ErrorResponse["error"]): void {
  sendJson(response, status, errorResponseSchema.parse({ error }));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > maxBodyBytes) {
      throw new HttpError(413, { code: "body_too_large", message: `The body is over ${maxBodyBytes} bytes.` });
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, { code: "invalid_json", message: "The body is not valid JSON." });
  }
}

/** Finds the identity behind the request's bearer token, or throws a 401. */
async function authenticate(storage: StorageAdapter, request: IncomingMessage): Promise<Identity> {
  const header = request.headers.authorization;
  const match = header === undefined ? null : /^Bearer +(\S+)\s*$/i.exec(header);
  const token = match?.[1];
  if (token === undefined) {
    throw new HttpError(401, {
      code: "token_missing",
      message: "Send your token as `Authorization: Bearer <token>` (COOKOUT_TOKEN).",
    });
  }
  const found = await storage.findIdentityByTokenHash(hashToken(token));
  if (found.status === "revoked") {
    throw new HttpError(401, { code: "token_revoked", message: "This token was revoked. Ask an admin for a new one." });
  }
  if (found.status === "unknown") {
    throw new HttpError(401, { code: "token_unknown", message: "This token is not known to this cookout." });
  }
  return found.identity;
}

function requireAdmin(identity: Identity): void {
  if (!identity.admin) {
    throw new HttpError(403, { code: "admin_only", message: "Only an admin identity can do this." });
  }
}

function notAllowed(method: string | undefined, path: string): HttpError {
  return new HttpError(405, { code: "method_not_allowed", message: `${method} ${path} is not allowed.` });
}

function identityNotFound(name: string): HttpError {
  return new HttpError(404, { code: "identity_not_found", message: `There is no identity named ${name}.` });
}

function channelNotFound(name: string): HttpError {
  return new HttpError(404, { code: "channel_not_found", message: `There is no channel named ${name}.` });
}

function messageNotFound(id: number): HttpError {
  return new HttpError(404, { code: "message_not_found", message: `There is no message ${id}.` });
}

/**
 * Matches a route pattern and returns its captured path segments, already
 * percent-decoded (index 0 is the whole path). Every route with a parameter
 * goes through here, so a malformed segment (`%E0`) is 400 `invalid_path`,
 * never a 500. Returns `null` if the pattern doesn't match.
 */
function matchPath(pattern: RegExp, path: string): (string | undefined)[] | null {
  const match = pattern.exec(path);
  if (match === null) return null;
  try {
    return match.map((segment: string | undefined) => (segment === undefined ? undefined : decodeURIComponent(segment)));
  } catch {
    throw new HttpError(400, { code: "invalid_path", message: `The path ${path} is not valid percent-encoding.` });
  }
}

/** Parses a request body or query, or throws 400 `invalid_request` with the schema errors. */
function parseRequest<T>(
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: unknown } } },
  input: unknown,
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "invalid_request",
      message: "The request doesn't match the protocol.",
      details: parsed.error.issues,
    });
  }
  return parsed.data;
}

async function handle(options: ServerOptions, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const { storage, clock } = options;
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  const method = request.method;

  if (path === healthPath) {
    if (method !== "GET") throw notAllowed(method, path);
    try {
      await storage.checkHealth();
    } catch {
      throw new HttpError(503, { code: "storage_unavailable", message: "Storage is not usable." });
    }
    const body: HealthResponse = { status: "ok", time: clock.now().toISOString() };
    sendJson(response, 200, healthResponseSchema.parse(body));
    return;
  }

  const identityRoute = matchPath(/^\/v1\/identities\/([^/]+)(\/token)?$/, path);
  const channelRoute = matchPath(/^\/v1\/channels\/([^/]+)(\/messages)?$/, path);
  const threadRoute = matchPath(/^\/v1\/messages\/(\d+)\/thread$/, path);
  if (
    path !== whoamiPath &&
    path !== identitiesPath &&
    path !== channelsPath &&
    path !== messagesPath &&
    identityRoute === null &&
    channelRoute === null &&
    threadRoute === null
  ) {
    throw new HttpError(404, { code: "not_found", message: `No route for ${method} ${path}.` });
  }

  // Every route below needs a token.
  const caller = await authenticate(storage, request);

  if (path === channelsPath) {
    if (method === "GET") {
      const body: ListChannelsResponse = { channels: await storage.listChannels() };
      sendJson(response, 200, listChannelsResponseSchema.parse(body));
      return;
    }
    if (method === "POST") {
      // Any identity can create a channel (spec answer 12).
      const parsed = parseRequest(createChannelRequestSchema, await readJson(request));
      const channel: Channel = { name: parsed.name, createdAt: clock.now().toISOString() };
      if (parsed.description !== undefined) channel.description = parsed.description;
      if ((await storage.createChannel(channel)) === "name_taken") {
        throw new HttpError(409, { code: "channel_exists", message: `The channel ${channel.name} already exists.` });
      }
      const body: ChannelResponse = { channel };
      sendJson(response, 201, channelResponseSchema.parse(body));
      return;
    }
    throw notAllowed(method, path);
  }

  if (channelRoute !== null) {
    if (method !== "GET") throw notAllowed(method, path);
    const name = channelRoute[1] ?? "";
    if (channelRoute[2] === undefined) {
      const channel = await storage.findChannel(name);
      if (channel === undefined) throw channelNotFound(name);
      const body: ChannelResponse = { channel };
      sendJson(response, 200, channelResponseSchema.parse(body));
      return;
    }
    const search = new URL(request.url ?? "/", "http://localhost").searchParams;
    const query = parseRequest(listMessagesQuerySchema, Object.fromEntries(search));
    const page = await storage.listChannelMessages(
      name,
      query.before === undefined ? { limit: query.limit } : { before: query.before, limit: query.limit },
    );
    if (page === undefined) throw channelNotFound(name);
    const body: ListMessagesResponse = page;
    sendJson(response, 200, listMessagesResponseSchema.parse(body));
    return;
  }

  if (path === messagesPath) {
    if (method !== "POST") throw notAllowed(method, path);
    const parsed = parseRequest(postMessageRequestSchema, await readJson(request));
    const message: NewMessage = {
      channel: parsed.channel,
      author: caller.owner === undefined ? { name: caller.name } : { name: caller.name, owner: caller.owner },
      text: parsed.text,
      mentions: [],
      createdAt: clock.now().toISOString(),
    };
    if (parsed.data !== undefined) message.data = parsed.data;
    if (parsed.replyTo !== undefined) message.replyTo = parsed.replyTo;
    const result = await storage.appendMessage(message);
    if (result.status === "channel_not_found") throw channelNotFound(parsed.channel);
    if (result.status === "reply_to_not_found") throw messageNotFound(parsed.replyTo ?? 0);
    if (result.status === "reply_in_other_channel") {
      throw new HttpError(400, {
        code: "reply_in_other_channel",
        message: `Message ${parsed.replyTo} is not in ${parsed.channel}. Reply in the message's own channel.`,
      });
    }
    const body: MessageResponse = { message: result.message };
    sendJson(response, 201, messageResponseSchema.parse(body));
    return;
  }

  if (threadRoute !== null) {
    if (method !== "GET") throw notAllowed(method, path);
    const id = Number(threadRoute[1]);
    const thread = await storage.getThread(id);
    if (thread === undefined) throw messageNotFound(id);
    const body: ThreadResponse = thread;
    sendJson(response, 200, threadResponseSchema.parse(body));
    return;
  }

  if (path === whoamiPath) {
    if (method !== "GET") throw notAllowed(method, path);
    const body: IdentityResponse = { identity: caller };
    sendJson(response, 200, identityResponseSchema.parse(body));
    return;
  }

  if (path === identitiesPath) {
    if (method === "GET") {
      const body: ListIdentitiesResponse = { identities: await storage.listIdentities() };
      sendJson(response, 200, listIdentitiesResponseSchema.parse(body));
      return;
    }
    if (method === "POST") {
      requireAdmin(caller);
      const parsed = parseRequest(createIdentityRequestSchema, await readJson(request));
      const identity: Identity = { name: parsed.name, admin: false, createdAt: clock.now().toISOString() };
      if (parsed.owner !== undefined) identity.owner = parsed.owner;
      const token = options.newToken();
      if ((await storage.createIdentity(identity, hashToken(token))) === "name_taken") {
        throw new HttpError(409, { code: "identity_exists", message: `The name ${identity.name} is taken.` });
      }
      const body: IdentityWithTokenResponse = { identity, token };
      sendJson(response, 201, identityWithTokenResponseSchema.parse(body));
      return;
    }
    throw notAllowed(method, path);
  }

  if (identityRoute !== null) {
    const name = identityRoute[1] ?? "";
    const isTokenRoute = identityRoute[2] !== undefined;
    if (isTokenRoute && method === "POST") {
      requireAdmin(caller);
      const token = options.newToken();
      const identity = await storage.replaceToken(name, hashToken(token));
      if (identity === undefined) throw identityNotFound(name);
      const body: IdentityWithTokenResponse = { identity, token };
      sendJson(response, 200, identityWithTokenResponseSchema.parse(body));
      return;
    }
    if (!isTokenRoute && method === "DELETE") {
      requireAdmin(caller);
      const result = await storage.deleteIdentity(name);
      if (result.status === "not_found") throw identityNotFound(name);
      if (result.status === "last_admin") {
        throw new HttpError(409, {
          code: "last_admin",
          message: `${name} is the last admin. Make another admin before deleting it.`,
        });
      }
      const body: IdentityResponse = { identity: result.identity };
      sendJson(response, 200, identityResponseSchema.parse(body));
      return;
    }
  }
  throw notAllowed(method, path);
}

/** On a store with no identities, makes the `admin` identity and returns its token. */
async function createFirstAdmin(options: ServerOptions): Promise<string | undefined> {
  const token = options.newToken();
  const admin: Identity = { name: firstAdminName, admin: true, createdAt: options.clock.now().toISOString() };
  return (await options.storage.createIdentityIfNoneExist(admin, hashToken(token))) ? token : undefined;
}

/**
 * Starts the HTTP server with the storage, clock and token source it is
 * given. On first boot it also makes the admin identity (see `adminToken`).
 */
export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const adminToken = await createFirstAdmin(options);

  const server = createServer((request, response) => {
    handle(options, request, response).catch((error: unknown) => {
      if (response.headersSent) {
        response.end();
      } else if (error instanceof HttpError) {
        sendError(response, error.status, error.error);
      } else {
        sendError(response, 500, { code: "internal_error", message: "Something went wrong on the server." });
      }
    });
  });

  const host = options.host ?? "0.0.0.0";
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address: AddressInfo | string | null = server.address();
  if (address === null || typeof address === "string") throw new Error("The server has no TCP port.");
  const urlHost = address.family === "IPv6" ? `[${address.address}]` : address.address;

  return {
    url: `http://${urlHost}:${address.port}`,
    adminToken,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
