import type { LeaseResponse, LeaveResponse } from "../../index.ts";
import { identityNamePattern, isIdentityName } from "../../../identities/index.ts";
import { isLeaseId, leaseIdPattern } from "../../index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

const identityNameRule = Schema.isPattern(identityNamePattern, {
  message: "Use 1-64 lowercase letters, digits or '-'.",
});
const IdentityNameSchema = Schema.String.check(identityNameRule.abort()).pipe(
  Schema.refine(isIdentityName, { identifier: "IdentityName" }),
);

const leaseIdRule = Schema.isPattern(leaseIdPattern).abort();
const LeaseIdSchema = Schema.String.check(leaseIdRule).pipe(Schema.refine(isLeaseId, { identifier: "LeaseId" }));

export const JoinRequestSchema = Schema.Struct({
  as: IdentityNameSchema,
  force: Schema.optionalKey(Schema.Boolean),
});

export const LeaseResponseSchema = matchesWire<LeaseResponse>()(
  Schema.Struct({ expiresAt: IsoTimeSchema, leaseId: LeaseIdSchema }),
);

export const LeaveResponseSchema = matchesWire<LeaveResponse>()(Schema.Struct({ released: Schema.Literal(true) }));
