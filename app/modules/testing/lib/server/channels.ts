import type { Channel, ChannelName } from "../../../channels/index.ts";
import { expect } from "@effect/vitest";
import { isChannelName } from "../../../channels/index.ts";

interface ChannelFixtureOptions {
  readonly description?: string;
}

const CREATED_AT = "2026-01-01T00:00:00.000Z";

function channelName(value: string): ChannelName {
  if (isChannelName(value)) {
    return value;
  }
  return expect.unreachable(`${value} is not a channel name`);
}

function channelFixture(name: string, ...options: readonly ChannelFixtureOptions[]): Channel {
  const [{ description } = {}] = options;
  if (typeof description === "string") {
    return { createdAt: CREATED_AT, description, name: channelName(name) };
  }
  return { createdAt: CREATED_AT, name: channelName(name) };
}

export { type ChannelFixtureOptions, channelFixture, channelName };
