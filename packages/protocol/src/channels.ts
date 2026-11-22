import { z } from "zod";

/**
 * A channel's name: lowercase letters, digits and `-`, 1 to 80 characters,
 * unique on a server. A working default (cookout#5): the spec only says any
 * identity can create a channel. Change it here; everything else follows.
 */
export const channelNameSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,80}$/, "Use 1-80 lowercase letters, digits or '-'.");
export type ChannelName = z.infer<typeof channelNameSchema>;

export const channelDescriptionSchema = z.string().min(1).max(500);

/** A channel as the server shows it. */
export const channelSchema = z.object({
  name: channelNameSchema,
  description: channelDescriptionSchema.optional(),
  /** ISO 8601 UTC. */
  createdAt: z.iso.datetime(),
});
export type Channel = z.infer<typeof channelSchema>;

/** `GET /v1/channels` (list) and `POST /v1/channels` (create; any identity). */
export const channelsPath = "/v1/channels";

/** `GET /v1/channels/<name>`. */
export function channelPath(name: string): string {
  return `${channelsPath}/${encodeURIComponent(name)}`;
}

export const createChannelRequestSchema = z.object({
  name: channelNameSchema,
  description: channelDescriptionSchema.optional(),
});
export type CreateChannelRequest = z.infer<typeof createChannelRequestSchema>;

export const channelResponseSchema = z.object({ channel: channelSchema });
export type ChannelResponse = z.infer<typeof channelResponseSchema>;

/** Sorted by name. */
export const listChannelsResponseSchema = z.object({ channels: z.array(channelSchema) });
export type ListChannelsResponse = z.infer<typeof listChannelsResponseSchema>;
