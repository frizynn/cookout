import type { ActionMenuParts, MenuChoice } from "../../design-system/messages.tsx";
import type { ChannelName, MessageId, TopLevelMessage } from "../../sdk/index.ts";
import type { ThreadClosing, ThreadMessagesState } from "../../board/index.ts";
import type { MessageMenu } from "../../unread/index.ts";
import type { PanelAloneParts } from "../../design-system/layout.tsx";
import { hrefOf } from "../../paths/index.ts";
import { threadChoice } from "./use-message-menu.ts";
import { useMemo } from "react";

const TEXT = {
  alone: "Open thread on its own",
  back: "Back to channel",
  copyLink: "Copy link",
  markUnread: "Mark unread",
  menu: "Thread actions",
} as const;

interface ThreadHeaderOf {
  readonly alone: boolean;
  readonly channel: ChannelName;
  readonly thread: MessageId;
  readonly closing: ThreadClosing;
  readonly menu: MessageMenu;
  readonly state: ThreadMessagesState;
}

interface ThreadChoicesOf extends Omit<ThreadHeaderOf, "alone" | "state" | "thread"> {
  readonly parent: TopLevelMessage;
}

interface ThreadHeader {
  readonly alone: PanelAloneParts;
  readonly closeHref: string;
  readonly menu: ActionMenuParts | null;
}

async function copyAfter(previous: Promise<void>, text: string): Promise<void> {
  await previous;
  await globalThis.navigator.clipboard.writeText(text);
}

function threadChoices({ channel, closing, menu, parent }: ThreadChoicesOf): readonly MenuChoice[] {
  const { id } = parent;
  const link = new URL(hrefOf({ channel, name: "thread", thread: id }), globalThis.location.href).href;
  let copying = Promise.resolve();
  function copyLink(): void {
    copying = copyAfter(copying, link);
  }
  function markUnread(): void {
    menu.markUnread(id);
  }
  return [
    ...[threadChoice({ closing, message: parent })]
      .filter((choice) => choice !== null)
      .map((choice): MenuChoice => ({ href: null, icon: choice.icon, label: choice.label, onSelect: choice.onSelect })),
    { href: null, icon: "mark-unread", label: TEXT.markUnread, onSelect: markUnread },
    { href: null, icon: "copy-link", label: TEXT.copyLink, onSelect: copyLink },
  ];
}

function aloneLink({ alone, channel, thread }: Pick<ThreadHeaderOf, "alone" | "channel" | "thread">): PanelAloneParts {
  if (alone) {
    return { alone, href: hrefOf({ channel, name: "thread", thread }), label: TEXT.back };
  }
  return { alone, href: hrefOf({ alone: true, channel, name: "thread", thread }), label: TEXT.alone };
}

function useThreadHeader({ alone, channel, closing, menu, state, thread }: ThreadHeaderOf): ThreadHeader {
  const parent = state.status === "loaded" && state.parent;
  return useMemo(() => {
    const shown = { alone: aloneLink({ alone, channel, thread }), closeHref: hrefOf({ channel, name: "channel" }) };
    if (parent === false) {
      return { ...shown, menu: null };
    }
    return { ...shown, menu: { choices: threadChoices({ channel, closing, menu, parent }), label: TEXT.menu } };
  }, [alone, channel, closing, menu, parent, thread]);
}

export { useThreadHeader };
