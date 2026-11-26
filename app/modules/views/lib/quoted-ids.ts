import type { ChannelName, MessageId } from "../../sdk/index.ts";
import { isMessageId } from "../../messages/index.ts";
import { locationOf } from "../../paths/index.ts";

const QUOTE_PATTERN = /(?<![\w#./-])msg (?<id>\d+)(?!\w)/gu;
const REFERENCE = /(?<url>https?:\/\/[^\s<>()]+)|(?<![\w#./-])msg (?<id>\d+)(?!\w)/gu;
const CODE = /```[\s\S]*?```|`[^`\n]*`/gu;
const TRAILING = /[.,;:!?'"\]]+$/u;
const SHOWN_QUOTES = 3;

interface Linked {
  readonly channel: ChannelName;
  readonly id: MessageId;
}

interface OnBoard {
  readonly href: string;
  readonly origin: string;
}

interface Quoting {
  readonly text: string;
  readonly origin: string;
}

interface Reference extends OnBoard {
  readonly digits: string;
}

function quotedIdOf(digits: string): MessageId | null {
  const id = Number(digits);
  if (!isMessageId(id)) {
    return null;
  }
  return id;
}

function linkedMessageOf({ href, origin }: OnBoard): Linked | null {
  const trimmed = href.replace(TRAILING, "");
  if (!URL.canParse(trimmed)) {
    return null;
  }
  const url = new URL(trimmed);
  if (url.origin !== origin) {
    return null;
  }
  const { route } = locationOf(url.hash);
  if (route.name !== "thread") {
    return null;
  }
  return { channel: route.channel, id: route.message ?? route.thread };
}

function referencedIdOf(reference: Reference): MessageId | null {
  if (reference.href === "") {
    return quotedIdOf(reference.digits);
  }
  const linked = linkedMessageOf(reference);
  if (linked === null) {
    return null;
  }
  return linked.id;
}

function idsIn({ origin, text }: Quoting): readonly (MessageId | null)[] {
  const ids: (MessageId | null)[] = [];
  for (const { groups = {} } of text.replaceAll(CODE, " ").matchAll(REFERENCE)) {
    ids.push(referencedIdOf({ digits: groups["id"] ?? "", href: groups["url"] ?? "", origin }));
  }
  return ids;
}

function quotedIdsOf(quoting: Quoting): readonly MessageId[] {
  const ids = new Set<MessageId>();
  for (const id of idsIn(quoting)) {
    if (id !== null && ids.size < SHOWN_QUOTES) {
      ids.add(id);
    }
  }
  return [...ids];
}

export { QUOTE_PATTERN, linkedMessageOf, quotedIdOf, quotedIdsOf };
