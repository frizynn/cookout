import type { HttpMethod, HttpRequest, HttpResponse } from "../../http/client.ts";
import { CookoutError } from "./errors.ts";
import type { HeldLease } from "./held-lease.ts";
import type { LeaseId } from "../../leases/index.ts";
import { heldLease } from "./held-lease.ts";
import { isErrorResponse } from "./generated/validators.js";
import { leaseHeader } from "../../leases/index.ts";
import { readCookoutConnection } from "../../config/index.ts";
import { request } from "../../http/client.ts";

type Connection = { readonly url: string; readonly token?: string; readonly lease: HeldLease };

interface ConnectionOptions {
  readonly url?: string;
  readonly token?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly leaseId?: LeaseId;
}

const headersFor = (connection: Connection): Record<string, string> =>
  connection.token === undefined ? {} : { authorization: `Bearer ${connection.token}` };

function withLease(headers: Readonly<Record<string, string>>, lease: HeldLease): Readonly<Record<string, string>> {
  const leaseId = lease.current();
  if (typeof leaseId === "string") {
    return { ...headers, [leaseHeader]: leaseId };
  }
  return headers;
}

function forgetLostLease(lease: HeldLease, code: string): void {
  if (code === "lease_lost") {
    lease.drop();
  }
}

const refusal = (method: HttpMethod, path: string, response: HttpResponse): CookoutError =>
  isErrorResponse(response.json)
    ? new CookoutError({ status: response.status, ...response.json.error })
    : new CookoutError({
        status: response.status,
        code: "bad_response",
        message: `${method} ${path} failed with ${response.status} and no error body.`,
        details: response.text,
      });

const badBody = (method: HttpMethod, path: string, response: HttpResponse): CookoutError =>
  new CookoutError({
    status: response.status,
    code: "bad_response",
    message: `${method} ${path} returned a body that doesn't match the protocol.`,
    details: response.json,
  });

type Call<T> = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly query?: NonNullable<HttpRequest["query"]>;
  readonly body?: unknown;
  readonly isExpected: (body: unknown) => body is T;
};

export async function send<T>(connection: Connection, call: Call<T>): Promise<T> {
  const { method, path, isExpected, ...rest } = call;
  const headers = withLease(headersFor(connection), connection.lease);
  const response = await request({ ...rest, baseUrl: connection.url, method, path, headers });
  if (!response.ok) {
    const error = refusal(method, path, response);
    forgetLostLease(connection.lease, error.code);
    throw error;
  }
  if (!isExpected(response.json)) throw badBody(method, path, response);
  return response.json;
}

export function connectionFor({ env, leaseId, ...given }: ConnectionOptions): Connection {
  const connection = { ...readCookoutConnection(env), ...given };
  const url = connection.url ?? "";
  if (url === "") {
    throw new CookoutError({
      code: "url_missing",
      message: "Set COOKOUT_URL to the cookout server's address.",
      status: 0,
    });
  }
  return { ...connection, lease: heldLease(leaseId), url };
}

export const getJson = <T>(connection: Connection, path: string, isExpected: (body: unknown) => body is T) =>
  send(connection, { method: "GET", path, isExpected });
