import type { Channel, ChannelResponse, ListChannelsResponse } from "../../index.ts";
import { channelNamePattern, descriptionLength, isChannelName } from "../../index.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

const ChannelNameSchema = Schema.String.check(Schema.isPattern(channelNamePattern).abort()).pipe(
  Schema.refine(isChannelName, { identifier: "ChannelName" }),
);

const DescriptionSchema = Schema.String.check(
  Schema.isBetweenLength(descriptionLength.minimum, descriptionLength.maximum),
);

const IsoTimeSchema = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u));

const ChannelSchema = matchesWire<Channel>()(
  Schema.Struct({
    name: ChannelNameSchema,
    description: Schema.optionalKey(DescriptionSchema),
    createdAt: IsoTimeSchema,
  }),
);

export const CreateChannelRequestSchema = Schema.Struct({
  name: ChannelNameSchema,
  description: Schema.optionalKey(DescriptionSchema),
});

export const ChannelResponseSchema = matchesWire<ChannelResponse>()(Schema.Struct({ channel: ChannelSchema }));

export const ListChannelsResponseSchema = matchesWire<ListChannelsResponse>()(
  Schema.Struct({ channels: Schema.Array(ChannelSchema) }),
);
