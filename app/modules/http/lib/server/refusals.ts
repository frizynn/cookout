import { Array as Arr, Effect, Option, Schema, SchemaIssue } from "effect";
import type { ErrorBody, Refusal } from "../../index.ts";
import { HttpServerError, HttpServerResponse } from "effect/http";
import { echoed, errorCodes } from "../../index.ts";
import { ErrorResponseSchema } from "./wire.ts";

const isRefusal = Schema.is(
  Schema.Struct({
    code: Schema.Literals(errorCodes),
    details: Schema.optionalKey(Schema.Unknown),
    message: Schema.String,
    status: Schema.Int,
  }),
);

const isTagged = Schema.is(Schema.Struct({ _tag: Schema.String }));

const refusal = (status: number, error: ErrorBody): Refusal => ({ status, ...error });

const internal = refusal(500, { code: "internal_error", message: "Something went wrong on the server." });

const byTag: Readonly<Record<string, Refusal>> = {
  StorageUnavailable: refusal(503, { code: "storage_unavailable", message: "Storage is not usable." }),
};

export const methodNotAllowed = (method: string, path: string): Refusal =>
  refusal(405, { code: "method_not_allowed", message: `${method} ${echoed(path)} is not allowed.` });

export const notFound = (method: string, path: string): Refusal =>
  refusal(404, { code: "not_found", message: `No route for ${method} ${echoed(path)}.` });

interface Guarded {
  readonly address: string;
  readonly host: string;
  readonly method: string;
  readonly origin: string;
}

const FORBIDDEN = 403;
const MISDIRECTED = 421;
const LOOPBACK_NAMES = ["127.0.0.1", "localhost", "[::1]"];
const READ_METHODS = new Set(["GET", "HEAD"]);

function foreignHost(host: string): Refusal {
  return refusal(MISDIRECTED, {
    code: "foreign_host",
    message: `This server doesn't answer to the host ${echoed(host)}.`,
  });
}

function foreignOrigin(origin: string): Refusal {
  return refusal(FORBIDDEN, {
    code: "foreign_origin",
    message: `A write from ${echoed(origin)} is not allowed: writes come from this server's own pages.`,
  });
}

function hostsAt(address: string): ReadonlySet<string> {
  const listening = new URL(address);
  return new Set([...Arr.map(LOOPBACK_NAMES, (name) => `${name}:${listening.port}`), listening.host]);
}

function hostOf(origin: string): string {
  if (!URL.canParse(origin)) {
    return "";
  }
  return new URL(origin).host;
}

function isForeignWrite({ method, origin }: Guarded, hosts: ReadonlySet<string>): boolean {
  return origin !== "" && !READ_METHODS.has(method) && !hosts.has(hostOf(origin));
}

function guardRefusal(request: Guarded): Option.Option<Refusal> {
  const hosts = hostsAt(request.address);
  if (!hosts.has(request.host)) {
    return Option.some(foreignHost(request.host));
  }
  if (isForeignWrite(request, hosts)) {
    return Option.some(foreignOrigin(request.origin));
  }
  return Option.none();
}

const fromParseError = (error: HttpServerError.RequestParseError): Refusal =>
  error.reason === "BodyTooLarge"
    ? refusal(413, { code: "body_too_large", message: "The body is over 1 MiB." })
    : refusal(400, { code: "invalid_json", message: "The body is not valid JSON." });

const standardIssues = SchemaIssue.makeFormatterStandardSchemaV1();

const keyOf = (segment: PropertyKey | { readonly key: PropertyKey }) =>
  typeof segment === "object" ? segment.key : segment;

const fromSchemaError = (error: Schema.SchemaError): Refusal =>
  refusal(400, {
    code: "invalid_request",
    details: standardIssues(error.issue).issues.map(({ path = [], message }) => ({ message, path: path.map(keyOf) })),
    message: "The request doesn't match the protocol.",
  });

const parseErrorIn = (error: unknown) => (error instanceof HttpServerError.HttpServerError ? error.reason : error);

const fromServerError = (error: unknown): Refusal | undefined => {
  const reason = parseErrorIn(error);
  if (reason instanceof HttpServerError.RequestParseError) {
    return fromParseError(reason);
  }
  return Schema.isSchemaError(error) ? fromSchemaError(error) : undefined;
};

export const toRefusal = (error: unknown): Refusal => {
  if (isRefusal(error)) {
    return error;
  }
  const tagged = isTagged(error) ? byTag[error._tag] : undefined;
  return tagged ?? fromServerError(error) ?? internal;
};

export const respond = ({ status, ...error }: Refusal) =>
  HttpServerResponse.schemaJson(ErrorResponseSchema)({ error }, { status }).pipe(Effect.orDie);

export { guardRefusal };
