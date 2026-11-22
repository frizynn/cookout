import { Effect, Schema } from "effect";
import { HttpServerError, HttpServerResponse } from "effect/http";
import type { ErrorBody, Refusal } from "../../index.ts";
import { errorCodes } from "../../index.ts";
import { ErrorResponseSchema } from "./wire.ts";

const isRefusal = Schema.is(
  Schema.Struct({
    status: Schema.Int,
    code: Schema.Literals(errorCodes),
    message: Schema.String,
    details: Schema.optionalKey(Schema.Unknown),
  }),
);

const isTagged = Schema.is(Schema.Struct({ _tag: Schema.String }));

const refusal = (status: number, error: ErrorBody): Refusal => ({ status, ...error });

const internal = refusal(500, { code: "internal_error", message: "Something went wrong on the server." });

const byTag: Readonly<Record<string, Refusal>> = {
  StorageUnavailable: refusal(503, { code: "storage_unavailable", message: "Storage is not usable." }),
  SchemaError: refusal(400, { code: "invalid_request", message: "The request doesn't match the protocol." }),
};

export const methodNotAllowed = (method: string, path: string): Refusal =>
  refusal(405, { code: "method_not_allowed", message: `${method} ${path} is not allowed.` });

export const notFound = (method: string, path: string): Refusal =>
  refusal(404, { code: "not_found", message: `No route for ${method} ${path}.` });

const fromParseError = (error: HttpServerError.RequestParseError): Refusal =>
  error.reason === "BodyTooLarge"
    ? refusal(413, { code: "body_too_large", message: "The body is over 1 MiB." })
    : refusal(400, { code: "invalid_json", message: "The body is not valid JSON." });

const parseErrorIn = (error: unknown) => (error instanceof HttpServerError.HttpServerError ? error.reason : error);

const fromServerError = (error: unknown): Refusal | undefined => {
  const reason = parseErrorIn(error);
  return reason instanceof HttpServerError.RequestParseError ? fromParseError(reason) : undefined;
};

export const toRefusal = (error: unknown): Refusal => {
  if (isRefusal(error)) return error;
  const tagged = isTagged(error) ? byTag[error._tag] : undefined;
  return tagged ?? fromServerError(error) ?? internal;
};

export const respond = ({ status, ...error }: Refusal) =>
  HttpServerResponse.schemaJson(ErrorResponseSchema)({ error }, { status }).pipe(Effect.orDie);
