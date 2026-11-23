import type { UnreadCounts } from "../../unread/index.ts";

const NONE: UnreadCounts = { mentions: 0, plain: 0 };

function hasUnread(counts: UnreadCounts): boolean {
  return counts.mentions + counts.plain > NONE.plain;
}

export { NONE, hasUnread };
