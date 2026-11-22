import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";
import type { Identity, IdentityResponse } from "../../index.ts";
import { identityNamePattern, isIdentityName, isOwner, ownerPattern } from "../../index.ts";

const IdentityNameSchema = Schema.String.check(Schema.isPattern(identityNamePattern)).pipe(
  Schema.refine(isIdentityName, { identifier: "IdentityName" }),
);

const OwnerSchema = Schema.String.check(Schema.isPattern(ownerPattern)).pipe(
  Schema.refine(isOwner, { identifier: "Owner" }),
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
