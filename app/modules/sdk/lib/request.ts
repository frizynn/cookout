import type { HttpMethod, HttpResponse } from "../../http/client.ts";
import { request } from "../../http/client.ts";
import { CookoutError } from "./errors.ts";
import { isErrorResponse } from "./generated/validators.js";

type Connection = { readonly url: string; readonly token?: string };

const headersFor = (connection: Connection): Record<string, string> =>
  connection.token === undefined ? {} : { authorization: `Bearer ${connection.token}` };

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

async function send<T>(
  connection: Connection,
  method: HttpMethod,
  path: string,
  isExpected: (body: unknown) => body is T,
): Promise<T> {
  const response = await request({ baseUrl: connection.url, method, path, headers: headersFor(connection) });
  if (!response.ok) throw refusal(method, path, response);
  if (!isExpected(response.json)) throw badBody(method, path, response);
  return response.json;
}

export const getJson = <T>(connection: Connection, path: string, isExpected: (body: unknown) => body is T) =>
  send(connection, "GET", path, isExpected);
