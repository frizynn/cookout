/**
 * The web UI's paths: the one owner of its location hashes. `routeOf(hash)`
 * reads a hash as a `Route` (`#/`, no hash, and `#/inbox` the inbox, `#/login`,
 * `#/people` the people and agents, `#/people/<name>` the same with that
 * identity's profile open, `#/settings` the settings page and
 * `#/settings/<section>` the same with the focus on that section (`profile`,
 * `theme` or `agents`), `#/channels/<name>`,
 * `#/channels/<name>/threads/<id>` and `#/approve/<user code>` the approval
 * page for a login request); a channel name
 * that isn't a `ChannelName`, an identity name that isn't an `IdentityName`,
 * a thread ID that isn't a message ID, a section the settings page doesn't
 * have, or any other hash is `missing`. `hrefOf(route)` builds the hash a link to a route
 * goes to, so no view writes a path by hand.
 */
import type { ChannelName, IdentityName, MessageId } from "../sdk/index.ts";
import { isChannelName } from "../channels/index.ts";
import { isIdentityName } from "../identities/index.ts";
import { isMessageId } from "../messages/index.ts";
import { isUserCode } from "../logins/index.ts";

const settingsSections = ["profile", "theme", "agents"] as const;

type SettingsSection = (typeof settingsSections)[number];

type Route =
  | { readonly name: "login" }
  | { readonly name: "settings"; readonly section: SettingsSection | null }
  | { readonly name: "people" }
  | { readonly name: "profile"; readonly identity: IdentityName }
  | { readonly name: "inbox" }
  | { readonly name: "channel"; readonly channel: ChannelName }
  | { readonly name: "thread"; readonly channel: ChannelName; readonly thread: MessageId }
  | { readonly name: "approve"; readonly userCode: string }
  | { readonly name: "missing" };

type LinkedRoute = Extract<
  Route,
  { readonly name: "inbox" | "people" | "profile" | "settings" | "channel" | "thread" }
>;

type Matcher = (hash: string) => Route | false;

const INBOX = /^(?:#\/?|#\/inbox)?$/u;
const LOGIN = /^#\/login$/u;
const SETTINGS = /^#\/settings$/u;
const SECTION = /^#\/settings\/(?<section>[^/]+)$/u;
const PEOPLE = /^#\/people$/u;
const PROFILE = /^#\/people\/(?<identity>[^/]+)$/u;
const CHANNEL = /^#\/channels\/(?<channel>[^/]+)$/u;
const THREAD = /^#\/channels\/(?<channel>[^/]+)\/threads\/(?<thread>[^/]+)$/u;

const APPROVE = /^#\/approve\/(?<code>[^/]+)$/u;
const DIGITS = /^\d+$/u;
const MISSING: Route = { name: "missing" };

function channelRoute(channel: string): Route {
  if (!isChannelName(channel)) {
    return MISSING;
  }
  return { channel, name: "channel" };
}

function profileRoute(identity: string): Route {
  if (!isIdentityName(identity)) {
    return MISSING;
  }
  return { identity, name: "profile" };
}

function sectionRoute(section: string): Route {
  for (const each of settingsSections) {
    if (each === section) {
      return { name: "settings", section: each };
    }
  }
  return MISSING;
}

function approveRoute(userCode: string): Route {
  if (!isUserCode(userCode)) {
    return MISSING;
  }
  return { name: "approve", userCode };
}

function threadRoute(channel: string, thread: string): Route {
  const id = Number(thread);
  if (!isChannelName(channel) || !DIGITS.test(thread) || !isMessageId(id)) {
    return MISSING;
  }
  return { channel, name: "thread", thread: id };
}

const matchers: readonly Matcher[] = [
  (hash) => INBOX.test(hash) && { name: "inbox" },
  (hash) => LOGIN.test(hash) && { name: "login" },
  (hash) => SETTINGS.test(hash) && { name: "settings", section: null },
  (hash) => SECTION.test(hash) && sectionRoute(hash.replace(SECTION, "$<section>")),
  (hash) => PEOPLE.test(hash) && { name: "people" },
  (hash) => PROFILE.test(hash) && profileRoute(hash.replace(PROFILE, "$<identity>")),
  (hash) => APPROVE.test(hash) && approveRoute(hash.replace(APPROVE, "$<code>")),
  (hash) => CHANNEL.test(hash) && channelRoute(hash.replace(CHANNEL, "$<channel>")),
  (hash) => THREAD.test(hash) && threadRoute(hash.replace(THREAD, "$<channel>"), hash.replace(THREAD, "$<thread>")),
];

function settingsHref(section: SettingsSection | null): string {
  if (section === null) {
    return "#/settings";
  }
  return `#/settings/${section}`;
}

function channelHref(route: Extract<Route, { readonly name: "channel" | "thread" }>): string {
  if (route.name === "channel") {
    return `#/channels/${route.channel}`;
  }
  return `#/channels/${route.channel}/threads/${String(route.thread)}`;
}

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
  if (route.name === "inbox") {
    return "#/inbox";
  }
  if (route.name === "people") {
    return "#/people";
  }
  if (route.name === "profile") {
    return `#/people/${route.identity}`;
  }
  if (route.name === "settings") {
    return settingsHref(route.section);
  }
  return channelHref(route);
}

export type { LinkedRoute, Route, SettingsSection };
