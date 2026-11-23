import type { AgentSessionResponse, LeaveResponse } from "../../index.ts";
import { identityNamePattern, isIdentityName, isToken, tokenPattern } from "../../../identities/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Schema } from "effect";
import { idleExpiryPattern } from "../../index.ts";
import { matchesWire } from "../../../http/index.ts";

const identityNameRule = Schema.isPattern(identityNamePattern, {
  message: "Use 1-64 lowercase letters, digits or '-'.",
});
const IdentityNameSchema = Schema.String.check(identityNameRule.abort()).pipe(
  Schema.refine(isIdentityName, { identifier: "IdentityName" }),
);

const IdleExpirySchema = Schema.String.check(
  Schema.isPattern(idleExpiryPattern, {
    message: "Use a whole number of seconds, minutes, hours or days, such as 30d or 12h.",
  }).abort(),
);

const TokenSchema = Schema.String.check(Schema.isPattern(tokenPattern).abort()).pipe(
  Schema.refine(isToken, { identifier: "Token" }),
);

export const JoinRequestSchema = Schema.Struct({
  as: IdentityNameSchema,
  force: Schema.optionalKey(Schema.Boolean),
  idleExpiry: Schema.optionalKey(IdleExpirySchema),
});

export const AgentSessionResponseSchema = matchesWire<AgentSessionResponse>()(
  Schema.Struct({ agentSessionToken: TokenSchema, expiresAt: IsoTimeSchema, issuedAt: IsoTimeSchema }),
);

export const LeaveResponseSchema = matchesWire<LeaveResponse>()(Schema.Struct({ revoked: Schema.Literal(true) }));
