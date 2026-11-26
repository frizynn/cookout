import type { Message } from "../../sdk/index.ts";
import type { ReactNode } from "react";

const TEXT = {
  fallback: "the fallback",
  noPick: "the router picked no one",
  nobody: "Routed to no one",
  owner: "the channel's owner",
  router: "picked by the router",
  to: "Routed to",
} as const;

type Route = NonNullable<Message["route"]>;

interface RoutedMarkerProps {
  readonly message: Message;
}

function whyOf(route: Route): string {
  if (route.by === "channel-owner") {
    return TEXT.owner;
  }
  if (route.by === "router") {
    return TEXT.router;
  }
  return `${TEXT.fallback} (${route.error ?? TEXT.noPick})`;
}

function wordsOf(route: Route): string {
  if (!route.to.some(Boolean)) {
    return `${TEXT.nobody} (${route.error ?? TEXT.noPick})`;
  }
  const names = route.to.map((name) => `@${name}`).join(", ");
  return `${TEXT.to} ${names}, ${whyOf(route)}`;
}

export function RoutedMarker(props: RoutedMarkerProps): ReactNode {
  const route = props.message.route ?? null;
  if (route === null) {
    return null;
  }
  return <p className="text-[11px] font-medium text-muted-foreground">{wordsOf(route)}</p>;
}
