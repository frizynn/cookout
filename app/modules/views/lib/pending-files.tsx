import type { PendingAttachments } from "../../composer/index.ts";
import { PendingFile } from "./pending-file.tsx";
import { PendingList } from "../../design-system/controls.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TEXT = { pending: "Files to send" } as const;
const NONE = 0;

interface PendingFilesProps {
  readonly attachments: PendingAttachments;
}

export function PendingFiles(props: PendingFilesProps): ReactNode {
  const { attachments } = props;
  const { attachments: pending } = useSyncExternalStore(attachments.subscribe, attachments.snapshot);
  const handleRemove = attachments.remove;
  if (pending.length === NONE) {
    return null;
  }
  return (
    <PendingList label={TEXT.pending}>
      {pending.map((attachment) => (
        <PendingFile attachment={attachment} key={attachment.key} onRemove={handleRemove} />
      ))}
    </PendingList>
  );
}
