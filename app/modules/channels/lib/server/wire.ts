import type {
  BoardLimitsResponse,
  Channel,
  ChannelResponse,
  ChannelRoutingResponse,
  ListChannelsResponse,
  WakeOptionsResponse,
} from "../../index.ts";
import { boardLimitRange, channelNamePattern, descriptionLength, isChannelName } from "../../index.ts";
import { isWebUrl, matchesWire } from "../../../http/index.ts";
import { IdentityNameSchema } from "../../../identities/server.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Schema } from "effect";

const ROUTER_URL_MAXIMUM_LENGTH = 2048;
const WAKE_NAME_LENGTH = { maximum: 100, minimum: 1 } as const;

const ChannelNameSchema = Schema.String.check(Schema.isPattern(channelNamePattern).abort()).pipe(
  Schema.refine(isChannelName, { identifier: "ChannelName" }),
);

const DescriptionSchema = Schema.String.check(
  Schema.isBetweenLength(descriptionLength.minimum, descriptionLength.maximum),
);

const WakeNameSchema = Schema.String.check(Schema.isBetweenLength(WAKE_NAME_LENGTH.minimum, WAKE_NAME_LENGTH.maximum));

const FallbackWakeSchema = Schema.Struct({ effort: WakeNameSchema, harness: WakeNameSchema, model: WakeNameSchema });

const WakeModelSchema = Schema.Struct({
  hint: Schema.optionalKey(Schema.String),
  label: Schema.String,
  name: WakeNameSchema,
});

const WakeHarnessSchema = Schema.Struct({
  efforts: Schema.Array(WakeNameSchema),
  label: Schema.String,
  models: Schema.Array(WakeModelSchema),
  name: WakeNameSchema,
});

const WakeOptionsSchema = Schema.Struct({ harnesses: Schema.Array(WakeHarnessSchema) });

const ChannelSchema = matchesWire<Channel>()(
  Schema.Struct({
    createdAt: IsoTimeSchema,
    description: Schema.optionalKey(DescriptionSchema),
    fallback: Schema.optionalKey(IdentityNameSchema),
    fallbackWake: Schema.optionalKey(FallbackWakeSchema),
    name: ChannelNameSchema,
    owner: Schema.optionalKey(IdentityNameSchema),
    router: Schema.optionalKey(Schema.String),
  }),
);

const RouterUrlSchema = Schema.String.check(
  Schema.isMaxLength(ROUTER_URL_MAXIMUM_LENGTH).abort(),
  Schema.makeFilter(isWebUrl, { message: "Use an http or https URL." }),
);

const LimitSchema = Schema.Int.check(
  Schema.isBetween({ maximum: boardLimitRange.maximum, minimum: boardLimitRange.minimum }),
);

export const CreateChannelRequestSchema = Schema.Struct({
  description: Schema.optionalKey(DescriptionSchema),
  name: ChannelNameSchema,
});

export const ListChannelsQuerySchema = Schema.Struct({ subscribed: Schema.optionalKey(Schema.Literal("true")) });

export const ChannelResponseSchema = matchesWire<ChannelResponse>()(Schema.Struct({ channel: ChannelSchema }));

export const ListChannelsResponseSchema = matchesWire<ListChannelsResponse>()(
  Schema.Struct({ channels: Schema.Array(ChannelSchema) }),
);

export const SetChannelRoutingRequestSchema = Schema.Struct({
  fallback: Schema.optionalKey(Schema.String),
  fallbackWake: Schema.optionalKey(FallbackWakeSchema),
  owner: Schema.optionalKey(Schema.String),
  router: Schema.optionalKey(RouterUrlSchema),
});

export const ChannelRoutingResponseSchema = matchesWire<ChannelRoutingResponse>()(
  Schema.Struct({ channel: ChannelSchema, routerSecret: Schema.optionalKey(Schema.String) }),
);

export const BoardLimitsSchema = Schema.Struct({ agentMentions: LimitSchema, agentTurns: LimitSchema });

export const BoardLimitsResponseSchema = matchesWire<BoardLimitsResponse>()(
  Schema.Struct({ limits: BoardLimitsSchema }),
);

export const WakeOptionsResponseSchema = matchesWire<WakeOptionsResponse>()(
  Schema.Struct({ options: WakeOptionsSchema }),
);

export { ChannelNameSchema, ChannelSchema, WakeOptionsSchema };
