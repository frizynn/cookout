# `@ai-hero/cookout/sdk` API report

The SDK's public surface: the built `dist/sdk.d.ts`, as consumers of the published package see it. `pnpm check` fails when it and the code disagree; after a deliberate change to the SDK's surface, run `pnpm api:write` and commit the result.

```ts
type HealthResponse = {
  readonly status: "ok";
  readonly time: string;
};
declare const errorCodes: readonly ["token_missing", "token_unknown", "token_revoked", "admin_only", "identity_exists", "identity_not_found", "last_admin", "not_found", "method_not_allowed", "invalid_path", "invalid_json", "invalid_request", "body_too_large", "storage_unavailable", "internal_error"];
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
/** The secret an identity sends as `Authorization: Bearer <token>`. */
type Token = Brand<"Token">;
/** An identity as the server shows it. Its token is never part of it. */
type Identity = {
  readonly name: IdentityName;
  readonly owner?: Owner;
  /** Admins can create identities, rotate tokens and delete identities. */
  readonly admin: boolean;
  /** ISO 8601 UTC. */
  readonly createdAt: string;
};
/** The answer to `GET /v1/whoami` and `DELETE /v1/identities/<name>`. */
type IdentityResponse = {
  readonly identity: Identity;
};
/** The answer to creating an identity and rotating its token. The token is shown this once only. */
type IdentityWithTokenResponse = {
  readonly identity: Identity;
  readonly token: Token;
};
/** The answer to `GET /v1/identities`: every identity, sorted by name. */
type ListIdentitiesResponse = {
  readonly identities: ReadonlyArray<Identity>;
};
/** The body of `POST /v1/identities`. The server checks the name and owner rules. */
type CreateIdentityRequest = {
  readonly name: string;
  readonly owner?: string;
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
  /** `GET /v1/identities`: every identity and its owner, sorted by name. */
  readonly listIdentities: () => Promise<ListIdentitiesResponse>;
  /** Admin only. The token in the answer is shown this once. A name in use is 409 `identity_exists`. */
  readonly createIdentity: (request: CreateIdentityRequest) => Promise<IdentityWithTokenResponse>;
  /** Admin only. Issues a new token; the old one stops working at once. */
  readonly rotateToken: (name: string) => Promise<IdentityWithTokenResponse>;
  /** Admin only. Removes the identity; its token stops working. The last admin can't be deleted (409 `last_admin`). */
  readonly deleteIdentity: (name: string) => Promise<IdentityResponse>;
};
/**
 * A client for the server at `url` with `token`, each defaulting to
 * `COOKOUT_URL` and `COOKOUT_TOKEN`. Throws `CookoutError` code `url_missing`
 * (status 0) when there is no URL.
 */
export declare function createCookoutClient(options?: CookoutClientOptions): CookoutClient;
export type { CookoutErrorCode, CreateIdentityRequest, HealthResponse, Identity, IdentityName, IdentityResponse, IdentityWithTokenResponse, ListIdentitiesResponse, Owner, Token };
```
