import { Button, Notice } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TEXT = { dismiss: "Dismiss" } as const;

interface DeletedNoticeProps {
  readonly board: Board;
}

export function DeletedNotice(props: DeletedNoticeProps): ReactNode {
  const { board } = props;
  const { notice } = useSyncExternalStore(board.subscribe, board.snapshot);
  const handleDismiss = board.dismissNotice;
  if (notice === null) {
    return null;
  }
  return (
    <Notice>
      <span>{`#${notice} was deleted, so you're back in your inbox.`}</span>
      <Button onClick={handleDismiss}>{TEXT.dismiss}</Button>
    </Notice>
  );
}
