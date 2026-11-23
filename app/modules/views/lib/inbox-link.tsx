import { NavLink, Pill } from "../../design-system/index.tsx";
import type { InboxItem } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import type { UnreadState } from "../../unread/index.ts";
import { hrefOf } from "../../paths/index.ts";

const TEXT = { inbox: "Inbox" } as const;

const NONE = 0;

interface InboxLinkProps {
  readonly active: boolean;
  readonly unread: UnreadState;
}

function itemsOf(unread: UnreadState): readonly InboxItem[] {
  if (unread.status !== "loaded") {
    return [];
  }
  return unread.items;
}

function toneOf(items: readonly InboxItem[]): "loud" | "quiet" {
  if (items.some((item) => item.reasons.includes("mention"))) {
    return "loud";
  }
  return "quiet";
}

export function InboxLink(props: InboxLinkProps): ReactNode {
  const items = itemsOf(props.unread);
  const count = items.length;
  return (
    <NavLink
      active={props.active}
      href={hrefOf({ name: "inbox" })}
      icon="inbox"
      label={TEXT.inbox}
      marked={count > NONE}
    >
      {count > NONE && <Pill count={count} label={`${String(count)} unread`} tone={toneOf(items)} />}
    </NavLink>
  );
}
