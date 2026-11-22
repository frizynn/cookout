/**
 * Identities on the wire, shared by the server, the SDK and the web: the
 * `IdentityName`, `Owner`, `Token` and `TokenHash` brands and their
 * constructors, the identity as the server shows it, the routes, and the
 * error codes bearer auth and the admin check answer with.
 */

declare const brand: unique symbol;

type Brand<Name extends string> = string & { readonly [brand]: Name };

/** An identity's name: 1–64 lowercase letters, digits or `-`, so `@name` mentions parse cleanly. Unique on a server. */
export type IdentityName = Brand<"IdentityName">;

/** The person an identity belongs to, such as `matt`: 1–100 characters. */
export type Owner = Brand<"Owner">;

/** The secret an identity sends as `Authorization: Bearer <token>`. */
export type Token = Brand<"Token">;

/** What the store keeps instead of a token. */
export type TokenHash = Brand<"TokenHash">;

const as = <B extends Brand<string>>(value: string): B => value as B;

/** The rule every identity name follows, for the backend's Schemas. */
export const identityNamePattern = /^[a-z0-9-]{1,64}$/u;

/** 1–100 characters: the owner rule as the SDK's validators check it. */
export const ownerPattern = /^[\s\S]{1,100}$/u;

/** Whether `value` follows the identity-name rule; if so, it is an `IdentityName`. */
export function isIdentityName(value: string): value is IdentityName {
  return identityNamePattern.test(value);
}

/** Whether `value` is the length of an owner; if so, it is an `Owner`. */
export function isOwner(value: string): value is Owner {
  return value.length >= 1 && value.length <= 100;
}

/** Marks a string as a token. Only `secrets` issues one, and only bearer auth reads one from a request. */
export function token(value: string): Token {
  return as(value);
}

/** Marks a string as a token hash. Only `secrets` hashes a token, and only the store reads one back. */
export function tokenHash(value: string): TokenHash {
  return as(value);
}

/** The name of the admin identity the server makes on its first boot. */
export const firstAdminName: IdentityName = as("admin");

/** An identity as the server shows it. Its token is never part of it. */
export type Identity = {
  readonly name: IdentityName;
  readonly owner?: Owner;
  /** Admins can create identities, rotate tokens and delete identities. */
  readonly admin: boolean;
  /** ISO 8601 UTC. */
  readonly createdAt: string;
};

/** The answer to `GET /v1/whoami`. */
export type IdentityResponse = {
  readonly identity: Identity;
};

/** `GET /v1/whoami`: the identity behind the token. */
export const whoamiPath = "/v1/whoami";

/** The codes bearer auth (401) and the admin check (403) refuse with. */
export const identityErrorCodes = ["token_missing", "token_unknown", "token_revoked", "admin_only"] as const;
