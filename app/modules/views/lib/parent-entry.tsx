import type { MenuClosing, Reply } from "./use-message-menu.ts";
import type { Message, MessageId, ReadReceipt } from "../../sdk/index.ts";
import { DeletedMessage } from "../../design-system/messages.tsx";
import type { MessageMenu } from "../../unread/index.ts";
import type { ReactNode } from "react";
import { StandaloneEntry } from "./standalone-entry.tsx";
import { isFresh } from "./stream-rows.ts";

interface ParentEntryProps {
  readonly readPosition: number | null;
  readonly message: Message;
  readonly deleted: ReadonlySet<MessageId>;
  readonly me: string;
  readonly label: string;
  readonly receipts: readonly ReadReceipt[];
  readonly menu: MessageMenu;
  readonly closing: MenuClosing;
  readonly reply: Reply | null;
}

export function ParentEntry(props: ParentEntryProps): ReactNode {
  if (props.deleted.has(props.message.id)) {
    return <DeletedMessage />;
  }
  return (
    <StandaloneEntry
      closing={props.closing}
      fresh={isFresh({ id: props.message.id, readPosition: props.readPosition })}
      label={props.label}
      me={props.me}
      menu={props.menu}
      message={props.message}
      receipts={props.receipts}
      reply={props.reply}
    />
  );
}
