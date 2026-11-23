import type { Channel, ChannelResponse, ListChannelsResponse } from "../../index.ts";
import { channelNamePattern, descriptionLength, isChannelName } from "../../index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

const ChannelNameSchema = Schema.String.check(Schema.isPattern(channelNamePattern).abort()).pipe(
  Schema.refine(isChannelName, { identifier: "ChannelName" }),
);

const DescriptionSchema = Schema.String.check(
  Schema.isBetweenLength(descriptionLength.minimum, descriptionLength.maximum),
);

const ChannelSchema = matchesWire<Channel>()(
  Schema.Struct({
    createdAt: IsoTimeSchema,
    description: Schema.optionalKey(DescriptionSchema),
    name: ChannelNameSchema,
  }),
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

export { ChannelNameSchema, ChannelSchema };
