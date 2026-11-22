/**
 * The cookout's wire protocol, shared by the server, the SDK and the web: route
 * paths, the error body every refusal uses, the union of every error code, and
 * the check that ties each backend Schema to its plain-TS wire type.
 */
import { channelErrorCodes } from "../channels/index.ts";
import { identityErrorCodes } from "../identities/index.ts";
import { messageErrorCodes } from "../messages/index.ts";

export const healthPath = "/v1/health";

export type HealthResponse = {
  readonly status: "ok";
  readonly time: string;
};

export const errorCodes = [
  ...identityErrorCodes,
  ...channelErrorCodes,
  ...messageErrorCodes,
  "not_found",
  "method_not_allowed",
  "invalid_path",
  "invalid_json",
  "invalid_request",
  "body_too_large",
  "storage_unavailable",
  "internal_error",
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export type ErrorBody = {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: unknown;
};

export type ErrorResponse = {
  readonly error: ErrorBody;
};

/** A refusal a backend handler fails with: the HTTP status and the error body to answer with. */
export type Refusal = ErrorBody & {
  readonly status: number;
};

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type SameShape<A, B> = Same<A, B> extends true ? Same<keyof A, keyof B> : false;

/**
 * Returns the backend Schema unchanged, and fails to compile unless the type it
 * decodes to and the wire type are assignable both ways and have the same keys.
 */
export function matchesWire<Wire>() {
  return <S extends { readonly Type: unknown }>(
    schema: S & (SameShape<S["Type"], Wire> extends true ? unknown : { readonly wireMismatch: Wire }),
  ): S => schema;
}
