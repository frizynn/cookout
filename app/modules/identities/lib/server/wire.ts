import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";
import type { Identity, IdentityResponse, IdentityWithTokenResponse, ListIdentitiesResponse } from "../../index.ts";
import { identityNamePattern, isIdentityName, isOwner, isToken, ownerPattern, tokenPattern } from "../../index.ts";

export const IdentityNameSchema = Schema.String.check(
  Schema.isPattern(identityNamePattern, { message: "Use 1-64 lowercase letters, digits or '-'." }),
).pipe(Schema.refine(isIdentityName, { identifier: "IdentityName" }));

export const OwnerSchema = Schema.String.check(
  Schema.isPattern(ownerPattern, { message: "Use 1-100 characters." }),
).pipe(Schema.refine(isOwner, { identifier: "Owner" }));

const TokenSchema = Schema.String.check(Schema.isPattern(tokenPattern)).pipe(
  Schema.refine(isToken, { identifier: "Token" }),
);

const IdentitySchema = matchesWire<Identity>()(
  Schema.Struct({
    name: IdentityNameSchema,
    owner: Schema.optionalKey(OwnerSchema),
    admin: Schema.Boolean,
    createdAt: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)),
  }),
);

export const IdentityResponseSchema = matchesWire<IdentityResponse>()(Schema.Struct({ identity: IdentitySchema }));

export const IdentityWithTokenResponseSchema = matchesWire<IdentityWithTokenResponse>()(
  Schema.Struct({ identity: IdentitySchema, token: TokenSchema }),
);

export const ListIdentitiesResponseSchema = matchesWire<ListIdentitiesResponse>()(
  Schema.Struct({ identities: Schema.Array(IdentitySchema) }),
);
