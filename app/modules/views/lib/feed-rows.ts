import type { FeedPart, Fold } from "./closed-folds.ts";
import type { MessageId, TopLevelMessage } from "../../sdk/index.ts";
import type { StreamRow } from "./stream-rows.ts";
import { foldClosed } from "./closed-folds.ts";
import { streamRows } from "./stream-rows.ts";

const FIRST = 0;
const ONE = 1;

type FeedRow = { readonly kind: "fold"; readonly fold: Fold } | { readonly kind: "message"; readonly row: StreamRow };

interface FeedOf {
  readonly messages: readonly TopLevelMessage[];
  readonly expanded: ReadonlyMap<MessageId, number>;
  readonly readPosition: number | null;
  readonly me: string;
}

function brokenAt(row: StreamRow, afterFold: ReadonlySet<MessageId>): StreamRow {
  if (!afterFold.has(row.message.id)) {
    return row;
  }
  return { ...row, grouped: false };
}

function feedRows(feed: FeedOf): readonly FeedRow[] {
  const parts: readonly FeedPart[] = foldClosed(feed);
  const shown = parts.filter((part) => part.kind === "message");
  const afterFold = new Set(shown.filter((part) => part.afterFold).map((part) => part.message.id));
  const rows = streamRows({ ...feed, after: null, messages: shown.map((part) => part.message) });
  let next = FIRST;
  return parts.flatMap((part): readonly FeedRow[] => {
    if (part.kind === "fold") {
      return [{ fold: part, kind: "fold" }];
    }
    const row = rows.slice(next, next + ONE);
    next += ONE;
    return row.map((each) => ({ kind: "message", row: brokenAt(each, afterFold) }));
  });
}

export { feedRows };
