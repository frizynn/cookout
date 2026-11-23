import { CookoutError, isServerErrorCode } from "./errors.ts";
import type { HttpMethod, HttpRequest, HttpResponse, OpenEventStream } from "../../http/client.ts";
import { leaseHeader, leaseLost } from "../../leases/index.ts";
import { openEventStream, request } from "../../http/client.ts";
import type { CookoutConnection } from "../../config/index.ts";
import type { CookoutErrorCode } from "./errors.ts";
import type { HeldLease } from "./held-lease.ts";
import type { LeaseId } from "../../leases/index.ts";
import { heldLease } from "./held-lease.ts";
import { isErrorResponse } from "./generated/validators.js";
import { readCookoutConnection } from "../../config/index.ts";

interface ClientConnection extends CookoutConnection {
  readonly lease: HeldLease;
}

interface ConnectionOptions extends Partial<CookoutConnection> {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly leaseId?: LeaseId;
}

interface Call<Answer> {
  readonly method: HttpMethod;
  readonly path: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly query?: NonNullable<HttpRequest["query"]>;
  readonly body?: unknown;
  readonly isExpected: (body: unknown) => body is Answer;
}

interface EventsCall {
  readonly connection: ClientConnection;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string>>;
}

const NO_STATUS = 0;
const NO_HEADERS = {};

function tokenHeaders(token: string | undefined): Readonly<Record<string, string>> {
  if (typeof token === "string") {
    return { authorization: `Bearer ${token}` };
  }
  return NO_HEADERS;
}

function headersFor({ lease, token }: ClientConnection): Readonly<Record<string, string>> {
  const leaseId = lease.current();
  if (typeof leaseId === "string") {
    return { ...tokenHeaders(token), [leaseHeader]: leaseId };
  }
  return tokenHeaders(token);
}

function forgetLostLease(lease: HeldLease, code: CookoutErrorCode): void {
  if (code === leaseLost) {
    lease.drop();
  }
}

function refusal(method: HttpMethod, path: string, response: HttpResponse): CookoutError {
  const { json, status, text } = response;
  if (isErrorResponse(json) && isServerErrorCode(json.error.code)) {
    return new CookoutError({ ...json.error, code: json.error.code, status });
  }
  return new CookoutError({
    code: "bad_response",
    details: text,
    message: `${method} ${path} failed with ${String(status)} and no error body.`,
    status,
  });
}

function badBody(method: HttpMethod, path: string, { json, status }: HttpResponse): CookoutError {
  return new CookoutError({
    code: "bad_response",
    details: json,
    message: `${method} ${path} returned a body that doesn't match the protocol.`,
    status,
  });
}

export async function send<Answer>(connection: ClientConnection, call: Call<Answer>): Promise<Answer> {
  const { isExpected, method, path, ...rest } = call;
  const response = await request({ ...rest, baseUrl: connection.url, headers: headersFor(connection), method, path });
  if (!response.ok) {
    const error = refusal(method, path, response);
    forgetLostLease(connection.lease, error.code);
    throw error;
  }
  if (!isExpected(response.json)) {
    throw badBody(method, path, response);
  }
  return response.json;
}

export async function openEvents({ connection, headers, path, query = {} }: EventsCall): Promise<OpenEventStream> {
  const method = "GET";
  const sent = { ...headers, ...headersFor(connection) };
  const opened = await openEventStream({ baseUrl: connection.url, headers: sent, method, path, query });
  if (!opened.ok) {
    const error = refusal(method, path, opened.response);
    forgetLostLease(connection.lease, error.code);
    throw error;
  }
  return opened;
}

export function connectionFor({ env, leaseId, ...given }: ConnectionOptions): ClientConnection {
  const connection = { ...readCookoutConnection(env), ...given };
  const { url = "" } = connection;
  if (url === "") {
    throw new CookoutError({
      code: "url_missing",
      message: "Set COOKOUT_URL to the cookout server's address.",
      status: NO_STATUS,
    });
  }
  return { ...connection, lease: heldLease(leaseId), url };
}

export async function getJson<Answer>(
  connection: ClientConnection,
  path: string,
  isExpected: (body: unknown) => body is Answer,
): Promise<Answer> {
  const answer = await send(connection, { isExpected, method: "GET", path });
  return answer;
}

export type { ClientConnection };
