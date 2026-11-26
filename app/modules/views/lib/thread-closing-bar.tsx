import { ClosedBy } from "./closed-by.tsx";
import { ClosingRefusal } from "./closing-refusal.tsx";
import type { ReactNode } from "react";
import { ThreadBar } from "../../design-system/messages.tsx";
import type { TopLevelMessage } from "../../sdk/index.ts";
import { closingOf } from "./use-thread-closing.ts";

interface ThreadClosingBarProps {
  readonly parent: TopLevelMessage;
}

export function ThreadClosingBar(props: ThreadClosingBarProps): ReactNode {
  const closed = closingOf(props.parent);
  return (
    <>
      {closed !== null && (
        <ThreadBar>
          <ClosedBy closing={closed} />
        </ThreadBar>
      )}
      <ClosingRefusal />
    </>
  );
}
