import { Alert } from "../../design-system/content.tsx";
import type { ReactNode } from "react";
import type { ThreadClosing } from "../../board/index.ts";
import { useSyncExternalStore } from "react";

interface ClosingRefusalProps {
  readonly closing: ThreadClosing;
}

export function ClosingRefusal(props: ClosingRefusalProps): ReactNode {
  const { closing } = props;
  const refusal = useSyncExternalStore(closing.subscribe, closing.refusal);
  if (refusal === null) {
    return null;
  }
  return <Alert>{`Couldn't ${refusal.action} the thread (${refusal.code}): ${refusal.message}`}</Alert>;
}
