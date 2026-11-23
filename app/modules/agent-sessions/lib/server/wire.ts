import type {
  AgentSessionResponse,
  LeaveResponse,
  ListAgentSessionsResponse,
  ListedAgentSession,
  RevokeAgentSessionResponse,
} from "../../index.ts";
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

const HOST_LENGTH = { maximum: 253, minimum: 1 } as const;

const HostSchema = Schema.String.check(
  Schema.isBetweenLength(HOST_LENGTH.minimum, HOST_LENGTH.maximum, { message: "Use 1-253 characters." }).abort(),
);

const ListedAgentSessionSchema = matchesWire<ListedAgentSession>()(
  Schema.Struct({
    expiresAt: IsoTimeSchema,
    host: Schema.optionalKey(HostSchema),
    issuedAt: IsoTimeSchema,
    lastUsedAt: Schema.optionalKey(IsoTimeSchema),
  }),
);

const TokenSchema = Schema.String.check(Schema.isPattern(tokenPattern).abort()).pipe(
  Schema.refine(isToken, { identifier: "Token" }),
);

export const JoinRequestSchema = Schema.Struct({
  as: IdentityNameSchema,
  force: Schema.optionalKey(Schema.Boolean),
  host: Schema.optionalKey(HostSchema),
  idleExpiry: Schema.optionalKey(IdleExpirySchema),
});

export const AgentSessionResponseSchema = matchesWire<AgentSessionResponse>()(
  Schema.Struct({
    agentSessionToken: TokenSchema,
    created: Schema.Boolean,
    expiresAt: IsoTimeSchema,
    identity: IdentityNameSchema,
    issuedAt: IsoTimeSchema,
  }),
);

export const ListAgentSessionsResponseSchema = matchesWire<ListAgentSessionsResponse>()(
  Schema.Struct({ agentSessions: Schema.Array(ListedAgentSessionSchema) }),
);

export const RevokeAgentSessionResponseSchema = matchesWire<RevokeAgentSessionResponse>()(
  Schema.Struct({ revoked: Schema.Boolean }),
);

export const LeaveResponseSchema = matchesWire<LeaveResponse>()(Schema.Struct({ revoked: Schema.Literal(true) }));
