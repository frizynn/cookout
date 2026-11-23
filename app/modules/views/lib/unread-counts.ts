import type { UnreadCounts } from "../../unread/index.ts";

const NONE = 0;

function hasUnread(counts: UnreadCounts): boolean {
  return counts.forYou + counts.activity > NONE;
}

export { NONE, hasUnread };
