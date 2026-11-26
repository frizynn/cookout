import type { ThreadClosing, ThreadMessagesState } from "../../board/index.ts";
import { useContext, useMemo } from "react";
import type { Closing } from "../../messages/index.ts";
import { LandingContext } from "../../landing/index.ts";
import type { PanelIconAction } from "../../design-system/layout.tsx";
import type { TopLevelMessage } from "../../sdk/index.ts";

const TEXT = { close: "Close thread", reopen: "Reopen thread" } as const;

const SWAPPED = {
  close: `aside[aria-label="Thread"] button[aria-label="${TEXT.reopen}"]`,
  reopen: `aside[aria-label="Thread"] button[aria-label="${TEXT.close}"]`,
} as const;

function closingOf(parent: TopLevelMessage): Closing | null {
  const { closedAt = null, closedBy = null } = parent;
  if (closedAt === null || closedBy === null) {
    return null;
  }
  return { closedAt, closedBy };
}

interface ThreadClosingOf {
  readonly closing: ThreadClosing;
  readonly state: ThreadMessagesState;
  readonly gone: boolean;
}

function useThreadClosing({ closing, gone, state }: ThreadClosingOf): PanelIconAction | null {
  const { watch } = useContext(LandingContext);
  const parent = state.status === "loaded" && !gone && state.parent;
  const id = parent !== false && parent.id;
  const closed = parent !== false && closingOf(parent) !== null;
  return useMemo(() => {
    if (id === false) {
      return null;
    }
    if (closed) {
      return {
        icon: "reopen",
        name: TEXT.reopen,
        onAction: () => {
          watch(SWAPPED.reopen);
          closing.reopen(id);
        },
      };
    }
    return {
      icon: "close",
      name: TEXT.close,
      onAction: () => {
        watch(SWAPPED.close);
        closing.close(id);
      },
    };
  }, [closed, closing, id, watch]);
}

export { closingOf, useThreadClosing };
