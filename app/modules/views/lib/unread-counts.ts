import type { UnreadCounts } from "../../unread/index.ts";

const NONE: UnreadCounts = { mentions: 0, plain: 0 };

const ONE = 1;

function mentionsLabel(mentions: number): string {
  if (mentions === ONE) {
    return "1 mention";
  }
  return `${String(mentions)} mentions`;
}

function hasUnread(counts: UnreadCounts): boolean {
  return counts.mentions + counts.plain > NONE.plain;
}

export { NONE, hasUnread, mentionsLabel };
