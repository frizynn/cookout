/**
 * Channels on the wire, shared by the server, the SDK and the web: the
 * `ChannelName` brand and its check, the channel as the server shows it, the
 * request and answers of the channel routes, their paths, and the error codes
 * they refuse with.
 */

declare const brand: unique symbol;

/** A channel's name: 1–80 lowercase letters, digits or `-`. Unique on a server. */
export type ChannelName = string & { readonly [brand]: "ChannelName" };

/** The rule every channel name follows, for the backend's Schemas. */
export const channelNamePattern = /^[a-z0-9-]{1,80}$/u;

/**
 * Whether `value` follows the channel-name rule; if so, it is a `ChannelName`.
 * @param value The name to check.
 * @returns Whether `value` is a `ChannelName`.
 */
export function isChannelName(value: string): value is ChannelName {
  return channelNamePattern.test(value);
}

/** The description rule, in UTF-16 code units as `String.length` counts them. */
export const descriptionLength = { maximum: 500, minimum: 1 } as const;

/** A channel as the server shows it. */
export type Channel = {
  readonly name: ChannelName;
  /** 1–500 characters. */
  readonly description?: string;
  /** ISO 8601 UTC. */
  readonly createdAt: string;
};

/** The body of `POST /v1/channels`. The server checks the name and description. */
export type CreateChannelRequest = {
  readonly name: string;
  readonly description?: string;
};

/** The answer to creating or getting a channel. */
export type ChannelResponse = {
  readonly channel: Channel;
};

/** The answer to `GET /v1/channels`: every channel, sorted by name. */
export type ListChannelsResponse = {
  readonly channels: ReadonlyArray<Channel>;
};

/** `GET /v1/channels` lists channels; `POST /v1/channels` creates one, for any identity. */
export const channelsPath = "/v1/channels";

/** `GET /v1/channels/:name`: one channel. */
export const channelPath = "/v1/channels/:name";

/** The codes the channel routes refuse with: a name in use (409) and a missing channel (404). */
export const channelErrorCodes = ["channel_exists", "channel_not_found"] as const;
