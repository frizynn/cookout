import type { Channel, ChannelName } from "../../../channels/index.ts";
import { Option } from "effect";
import { fixtureTime } from "./time.ts";
import { isChannelName } from "../../../channels/index.ts";

interface ChannelFixtureOptions {
  readonly description?: string;
}

function channelName(value: string): ChannelName {
  return Option.getOrThrow(Option.liftPredicate(value, isChannelName));
}

function channelFixture(name: string, ...options: readonly ChannelFixtureOptions[]): Channel {
  const [{ description } = {}] = options;
  if (typeof description === "string") {
    return { createdAt: fixtureTime, description, name: channelName(name) };
  }
  return { createdAt: fixtureTime, name: channelName(name) };
}

export { type ChannelFixtureOptions, channelFixture, channelName };
