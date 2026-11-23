import { useMemo, useRef } from "react";

const NEXT_TASK = 0;

interface AfterClose {
  readonly onChoose: (action: () => void) => void;
  readonly onCloseAutoFocus: () => void;
}

export function useAfterClose(): AfterClose {
  const chosen = useRef<(() => void) | null>(null);
  return useMemo(
    () => ({
      onChoose: (action: () => void) => {
        chosen.current = action;
      },
      onCloseAutoFocus: () => {
        const action = chosen.current;
        chosen.current = null;
        if (action !== null) {
          globalThis.setTimeout(action, NEXT_TASK);
        }
      },
    }),
    [],
  );
}
