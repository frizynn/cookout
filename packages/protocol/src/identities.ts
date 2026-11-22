import { z } from "zod";

/**
 * An identity's name: lowercase letters, digits and `-`, 1 to 64 characters,
 * so `@name` mentions parse cleanly. Names are unique on a server.
 */
export const identityNameSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,64}$/, "Use 1-64 lowercase letters, digits or '-'.");
export type IdentityName = z.infer<typeof identityNameSchema>;

/** The person an identity belongs to, e.g. `matt`. Optional: some identities have no owner. */
export const ownerSchema = z.string().min(1).max(100);

/** An identity as the server shows it. Its token is never part of it. */
export const identitySchema = z.object({
  name: identityNameSchema,
  owner: ownerSchema.optional(),
  /** Admins can create identities, rotate tokens and delete identities. */
  admin: z.boolean(),
  /** ISO 8601 UTC. */
  createdAt: z.iso.datetime(),
});
export type Identity = z.infer<typeof identitySchema>;

/**
 * A token: the secret an identity sends as `Authorization: Bearer <token>`.
 * The server makes it from at least 256 random bits and stores only its hash.
 */
export const tokenSchema = z.string().min(43);

/** `GET /v1/identities` (everyone) and `POST /v1/identities` (admin). */
export const identitiesPath = "/v1/identities";

/** `DELETE /v1/identities/<name>` (admin). */
export function identityPath(name: string): string {
  return `${identitiesPath}/${encodeURIComponent(name)}`;
}

/** `POST /v1/identities/<name>/token` (admin): issue a new token; the old one stops working at once. */
export function identityTokenPath(name: string): string {
  return `${identityPath(name)}/token`;
}

/** `GET /v1/whoami`: the identity behind the token. */
export const whoamiPath = "/v1/whoami";

export const createIdentityRequestSchema = z.object({
  name: identityNameSchema,
  owner: ownerSchema.optional(),
});
export type CreateIdentityRequest = z.infer<typeof createIdentityRequestSchema>;

/** The answer to create and rotate. The token is shown this once only. */
export const identityWithTokenResponseSchema = z.object({
  identity: identitySchema,
  token: tokenSchema,
});
export type IdentityWithTokenResponse = z.infer<typeof identityWithTokenResponseSchema>;

export const identityResponseSchema = z.object({ identity: identitySchema });
export type IdentityResponse = z.infer<typeof identityResponseSchema>;

/** Sorted by name. */
export const listIdentitiesResponseSchema = z.object({ identities: z.array(identitySchema) });
export type ListIdentitiesResponse = z.infer<typeof listIdentitiesResponseSchema>;
