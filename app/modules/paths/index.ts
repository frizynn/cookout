/**
 * The web UI's paths: the one owner of its location hashes. `routeOf(hash)`
 * reads a hash as a `Route` (`#/` the channel list, `#/login`, `#/inbox`,
 * `#/channels/<name>` and `#/channels/<name>/threads/<id>`); a channel name
 * that isn't a `ChannelName`, a thread ID that isn't a message ID, or any
 * other hash is `missing`. `hrefOf(route)` builds the hash a link to a route
 * goes to, so no view writes a path by hand.
 */
import type { ChannelName, MessageId } from "../sdk/index.ts";
import { isChannelName } from "../channels/index.ts";
import { isMessageId } from "../messages/index.ts";

type Route =
  | { readonly name: "channels" }
  | { readonly name: "login" }
  | { readonly name: "inbox" }
  | { readonly name: "channel"; readonly channel: ChannelName }
  | { readonly name: "thread"; readonly channel: ChannelName; readonly thread: MessageId }
  | { readonly name: "missing" };

type LinkedRoute = Extract<Route, { readonly name: "channels" | "inbox" | "channel" | "thread" }>;

type Matcher = (hash: string) => Route | false;

const CHANNELS = /^(?:#\/?)?$/u;
const LOGIN = /^#\/login$/u;
const INBOX = /^#\/inbox$/u;
const CHANNEL = /^#\/channels\/(?<channel>[^/]+)$/u;
const THREAD = /^#\/channels\/(?<channel>[^/]+)\/threads\/(?<thread>[^/]+)$/u;

const DIGITS = /^\d+$/u;
const MISSING: Route = { name: "missing" };

function channelRoute(channel: string): Route {
  if (!isChannelName(channel)) {
    return MISSING;
  }
  return { channel, name: "channel" };
}

function threadRoute(channel: string, thread: string): Route {
  const id = Number(thread);
  if (!isChannelName(channel) || !DIGITS.test(thread) || !isMessageId(id)) {
    return MISSING;
  }
  return { channel, name: "thread", thread: id };
}

const matchers: readonly Matcher[] = [
  (hash) => CHANNELS.test(hash) && { name: "channels" },
  (hash) => LOGIN.test(hash) && { name: "login" },
  (hash) => INBOX.test(hash) && { name: "inbox" },
  (hash) => CHANNEL.test(hash) && channelRoute(hash.replace(CHANNEL, "$<channel>")),
  (hash) => THREAD.test(hash) && threadRoute(hash.replace(THREAD, "$<channel>"), hash.replace(THREAD, "$<thread>")),
];

/**
 * Reads a location hash as the route it names.
 * @param hash The location hash, `#` included (or empty).
 * @returns The route, or `missing`.
 */
export function routeOf(hash: string): Route {
  for (const matcher of matchers) {
    const route = matcher(hash);
    if (route !== false) {
      return route;
    }
  }
  return MISSING;
}

/**
 * Builds the location hash a link to `route` goes to.
 * @param route Where the link goes.
 * @returns The hash, such as `#/channels/general`.
 */
export function hrefOf(route: LinkedRoute): string {
  if (route.name === "channels") {
    return "#/";
  }
  if (route.name === "inbox") {
    return "#/inbox";
  }
  if (route.name === "channel") {
    return `#/channels/${route.channel}`;
  }
  return `#/channels/${route.channel}/threads/${String(route.thread)}`;
}

export type { LinkedRoute, Route };
