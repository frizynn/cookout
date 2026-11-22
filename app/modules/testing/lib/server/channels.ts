import { expect } from "@effect/vitest";
import type { Channel, ChannelName } from "../../../channels/index.ts";
import { isChannelName } from "../../../channels/index.ts";

export const channelName = (value: string): ChannelName =>
  isChannelName(value) ? value : expect.unreachable(`${value} is not a channel name`);

export type ChannelFixtureOptions = { readonly description?: string };

export const channelFixture = (name: string, options: ChannelFixtureOptions = {}): Channel => {
  const base = { name: channelName(name), createdAt: "2026-01-01T00:00:00.000Z" };
  return options.description === undefined ? base : { ...base, description: options.description };
};
