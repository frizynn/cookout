/**
 * Identities on the wire, shared by the server, the SDK and the web: the
 * `IdentityName`, `Owner`, `Token` and `TokenHash` brands, the two identity kinds and their
 * constructors, the identity as the server shows it, the routes, and the
 * error codes bearer auth and the admin check answer with.
 */
import type { IsoTime } from "../time/index.ts";

declare const brand: unique symbol;

type Brand<Name extends string> = string & { readonly [brand]: Name };

type IdentityFields = {
  readonly name: IdentityName;
  readonly admin: boolean;
  readonly createdAt: IsoTime;
};

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

/** The owner rule, in UTF-16 code units as `String.length` counts them. */
export const ownerLength = { maximum: 100, minimum: 1 } as const;

/** Whether `value` follows the identity-name rule; if so, it is an `IdentityName`. */
export function isIdentityName(value: string): value is IdentityName {
  return identityNamePattern.test(value);
}

/** Whether `value` is the length of an owner; if so, it is an `Owner`. */
export function isOwner(value: string): value is Owner {
  return value.length >= ownerLength.minimum && value.length <= ownerLength.maximum;
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

/** The two kinds of identity. Every identity is exactly one of them. */
export const identityKinds = ["human", "agent"] as const;

/** Whether an identity is a person or an agent. Set when the identity is created, and never changed. */
export type IdentityKind = (typeof identityKinds)[number];

/** A person using the board as themself. A human is its own person, so it has no owner. An admin can create identities, rotate tokens and delete identities. */
export type HumanIdentity = IdentityFields & {
  readonly kind: "human";
};

/** A program on the board, which may belong to a person (its owner). */
export type AgentIdentity = IdentityFields & {
  readonly kind: "agent";
  readonly owner?: Owner;
};

/** An identity as the server shows it: a human or an agent, never both. Its token is never part of it. */
export type Identity = HumanIdentity | AgentIdentity;

/** The answer to `GET /v1/whoami` and `DELETE /v1/identities/<name>`. */
export type IdentityResponse = {
  readonly identity: Identity;
};

/** The answer to creating an identity and rotating its token. The token is shown this once only. */
export type IdentityWithTokenResponse = {
  readonly identity: Identity;
  readonly token: Token;
};

/** The answer to `GET /v1/identities`: every identity, sorted by name. */
export type ListIdentitiesResponse = {
  readonly identities: readonly Identity[];
};

/** The body of `POST /v1/identities`. The server checks the name and owner rules, and that a human has no owner. */
export type CreateIdentityRequest = {
  readonly name: string;
  readonly kind: IdentityKind;
  /** Only an agent can have an owner: a human with one is refused with 400. */
  readonly owner?: string;
};

/** `GET /v1/whoami`: the identity behind the token. */
export const whoamiPath = "/v1/whoami";

/** `GET /v1/identities` (any identity) and `POST /v1/identities` (admin). */
export const identitiesPath = "/v1/identities";

/** `DELETE /v1/identities/:name` (admin): removes the identity, and its token stops working. */
export const identityPath = "/v1/identities/:name";

/** `POST /v1/identities/:name/token` (admin): issues a new token, and the old one stops working at once. */
export const identityTokenPath = "/v1/identities/:name/token";

/** The rule every token the server issues follows, for the backend's Schemas. */
export const tokenPattern = /^cookout_[A-Za-z0-9_-]+$/u;

/** Whether `value` looks like a token the server issued; if so, it is a `Token`. */
export function isToken(value: string): value is Token {
  return tokenPattern.test(value);
}

/** The codes bearer auth (401), the admin check (403) and identity admin refuse with. */
export const identityErrorCodes = [
  "token_missing",
  "token_unknown",
  "token_revoked",
  "admin_only",
  "identity_exists",
  "identity_not_found",
  "last_admin",
] as const;
