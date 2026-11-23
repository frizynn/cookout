import { Alert, MoreButton } from "../../design-system/index.tsx";
import type { OpenThreads, OpenThreadsState } from "../../board/index.ts";
import type { ReactNode } from "react";

const TEXT = { loading: "Loading…", more: "Load more" } as const;

interface OpenThreadMoreProps {
  readonly openThreads: OpenThreads;
  readonly state: Extract<OpenThreadsState, { readonly status: "loaded" }>;
}

function moreLabel(loading: boolean): string {
  if (loading) {
    return TEXT.loading;
  }
  return TEXT.more;
}

export function OpenThreadMore(props: OpenThreadMoreProps): ReactNode {
  const { cursor, more } = props.state;
  const loading = more.status === "loading";
  const handleLoadMore = props.openThreads.loadMore;
  return (
    <>
      {cursor !== null && (
        <MoreButton loading={loading} onClick={handleLoadMore}>
          {moreLabel(loading)}
        </MoreButton>
      )}
      {more.status === "failed" && <Alert>{`Couldn't load more (${more.code}): ${more.message}`}</Alert>}
    </>
  );
}
