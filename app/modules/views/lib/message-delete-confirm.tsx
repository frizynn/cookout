import { DELETE_TEXT, outcomeWords, refusalWords, titleOf } from "./message-delete-words.ts";
import { useCallback, useContext, useSyncExternalStore } from "react";
import { Announcer } from "./announcer.ts";
import { ConfirmDialog } from "../../design-system/controls.tsx";
import type { ReactNode } from "react";
import { messageDeleting } from "../../board/index.ts";
import { useBoardStore } from "./use-board.ts";

export function MessageDeleteConfirm(): ReactNode {
  const store = useBoardStore();
  const deleting = useSyncExternalStore(store.subscribe, () => messageDeleting(store.snapshot()));
  const announce = useContext(Announcer);
  const { asked } = deleting;
  const handleCancel = store.calls.cancelDelete;
  const { deleteMessage } = store.calls;
  const handleConfirm = useCallback(() => {
    if (asked !== null) {
      deleteMessage(asked.id, (outcome) => {
        announce(outcomeWords(outcome));
      });
    }
  }, [announce, asked, deleteMessage]);
  return (
    <ConfirmDialog
      body={DELETE_TEXT.body}
      confirm={DELETE_TEXT.confirm}
      destructive
      error={refusalWords(deleting)}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      open={asked !== null}
      pending={deleting.pending}
      title={titleOf(asked)}
    />
  );
}
