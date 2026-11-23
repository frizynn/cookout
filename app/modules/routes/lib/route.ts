import type { MessageId } from "../../sdk/index.ts";
import { isMessageId } from "../../messages/index.ts";

type Route =
  | { readonly name: "channels" }
  | { readonly name: "login" }
  | { readonly name: "channel"; readonly channel: string }
  | { readonly name: "thread"; readonly channel: string; readonly thread: MessageId }
  | { readonly name: "missing" };

type Matcher = (hash: string) => Route | false;

const CHANNELS = /^(?:#\/?)?$/u;
const LOGIN = /^#\/login$/u;
const CHANNEL = /^#\/channels\/(?<channel>[^/]+)$/u;
const THREAD = /^#\/channels\/(?<channel>[^/]+)\/threads\/(?<thread>[^/]+)$/u;

const DIGITS = /^\d+$/u;

function threadRoute(channel: string, thread: string): Route {
  const id = Number(thread);
  if (!DIGITS.test(thread) || !isMessageId(id)) {
    return { name: "missing" };
  }
  return { channel, name: "thread", thread: id };
}

const matchers: readonly Matcher[] = [
  (hash) => CHANNELS.test(hash) && { name: "channels" },
  (hash) => LOGIN.test(hash) && { name: "login" },
  (hash) => CHANNEL.test(hash) && { channel: hash.replace(CHANNEL, "$<channel>"), name: "channel" },
  (hash) => THREAD.test(hash) && threadRoute(hash.replace(THREAD, "$<channel>"), hash.replace(THREAD, "$<thread>")),
];

function routeOf(hash: string): Route {
  for (const matcher of matchers) {
    const route = matcher(hash);
    if (route !== false) {
      return route;
    }
  }
  return { name: "missing" };
}

export { type Route, routeOf };
