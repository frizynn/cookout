import { ItemList, ItemRow } from "../../design-system/index.tsx";
import { MessageText } from "./message-text.tsx";
import type { ReactNode } from "react";
import type { Reply } from "../../sdk/index.ts";

const TEXT = { replies: "Replies" } as const;

interface RepliesProps {
  readonly replies: readonly Reply[];
}

export function Replies(props: RepliesProps): ReactNode {
  return (
    <ItemList label={TEXT.replies}>
      {props.replies.map((reply) => (
        <ItemRow key={reply.id}>
          <MessageText message={reply} />
        </ItemRow>
      ))}
    </ItemList>
  );
}
