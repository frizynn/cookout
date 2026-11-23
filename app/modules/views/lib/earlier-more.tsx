import { Alert, Button, FeedNote } from "../../design-system/index.tsx";
import type { Earlier, EarlierState } from "../../unread/index.ts";
import type { ReactNode } from "react";

const NONE = 0;

const TEXT = { end: "That's everything.", loading: "Loading…", more: "Load more" } as const;

interface EarlierMoreProps {
  readonly earlier: Earlier;
  readonly state: Extract<EarlierState, { readonly status: "loaded" }>;
}

function labelOf(loading: boolean): string {
  if (loading) {
    return TEXT.loading;
  }
  return TEXT.more;
}

export function EarlierMore(props: EarlierMoreProps): ReactNode {
  const { hasMore, items, more } = props.state;
  const handleLoadMore = props.earlier.loadMore;
  if (!hasMore) {
    return items.length > NONE && <FeedNote place="end">{TEXT.end}</FeedNote>;
  }
  return (
    <>
      <Button disabled={more.status === "loading"} onClick={handleLoadMore}>
        {labelOf(more.status === "loading")}
      </Button>
      {more.status === "failed" && <Alert>{`Couldn't load more (${more.code}): ${more.message}`}</Alert>}
    </>
  );
}
