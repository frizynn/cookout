import type { Channel } from "../../sdk/index.ts";

const TEXT = { owner: "Owner", router: "Router", withFallback: "Router, fallback" } as const;

function routerNote(channel: Channel): string | null {
  if (!("router" in channel)) {
    return null;
  }
  const fallback = channel.fallback ?? null;
  if (fallback === null) {
    return TEXT.router;
  }
  return `${TEXT.withFallback} @${fallback}`;
}

function routingNote(channel: Channel | null): string | null {
  if (channel === null) {
    return null;
  }
  const owner = channel.owner ?? null;
  if (owner !== null) {
    return `${TEXT.owner} @${owner}`;
  }
  return routerNote(channel);
}

export { routingNote };
