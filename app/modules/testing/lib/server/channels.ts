import type { Channel, ChannelName } from "../../../channels/index.ts";
import { Option } from "effect";
import { isChannelName } from "../../../channels/index.ts";

interface ChannelFixtureOptions {
  readonly description?: string;
}

const CREATED_AT = "2026-01-01T00:00:00.000Z";

function channelName(value: string): ChannelName {
  return Option.getOrThrow(Option.liftPredicate(value, isChannelName));
}

function channelFixture(name: string, ...options: readonly ChannelFixtureOptions[]): Channel {
  const [{ description } = {}] = options;
  if (typeof description === "string") {
    return { createdAt: CREATED_AT, description, name: channelName(name) };
  }
  return { createdAt: CREATED_AT, name: channelName(name) };
}

export { type ChannelFixtureOptions, channelFixture, channelName };
