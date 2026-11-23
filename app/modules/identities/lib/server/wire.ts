import type { Identity, IdentityResponse, IdentityWithTokenResponse, ListIdentitiesResponse } from "../../index.ts";
import { identityNamePattern, isIdentityName, isOwner, isToken, ownerLength, tokenPattern } from "../../index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

export const IdentityNameSchema = Schema.String.check(
  Schema.isPattern(identityNamePattern, { message: "Use 1-64 lowercase letters, digits or '-'." }),
).pipe(Schema.refine(isIdentityName, { identifier: "IdentityName" }));

export const OwnerSchema = Schema.String.check(
  Schema.isBetweenLength(ownerLength.minimum, ownerLength.maximum, { message: "Use 1-100 characters." }),
).pipe(Schema.refine(isOwner, { identifier: "Owner" }));

const TokenSchema = Schema.String.check(Schema.isPattern(tokenPattern)).pipe(
  Schema.refine(isToken, { identifier: "Token" }),
);

const HumanIdentitySchema = Schema.Struct({
  admin: Schema.Boolean,
  createdAt: IsoTimeSchema,
  kind: Schema.Literal("human"),
  name: IdentityNameSchema,
});

const AgentIdentitySchema = Schema.Struct({
  admin: Schema.Boolean,
  createdAt: IsoTimeSchema,
  kind: Schema.Literal("agent"),
  name: IdentityNameSchema,
  owner: Schema.optionalKey(OwnerSchema),
});

const IdentitySchema = matchesWire<Identity>()(Schema.Union([HumanIdentitySchema, AgentIdentitySchema]));

export const IdentityResponseSchema = matchesWire<IdentityResponse>()(Schema.Struct({ identity: IdentitySchema }));

export const IdentityWithTokenResponseSchema = matchesWire<IdentityWithTokenResponse>()(
  Schema.Struct({ identity: IdentitySchema, token: TokenSchema }),
);

export const ListIdentitiesResponseSchema = matchesWire<ListIdentitiesResponse>()(
  Schema.Struct({ identities: Schema.Array(IdentitySchema) }),
);
