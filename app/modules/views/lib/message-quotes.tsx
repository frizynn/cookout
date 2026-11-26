import type { Message } from "../../sdk/index.ts";
import { QuotedMessage } from "./quoted-message.tsx";
import type { ReactNode } from "react";
import { quotedIdsOf } from "./quoted-ids.ts";
import { useMemo } from "react";

interface MessageQuotesProps {
  readonly message: Message;
  readonly me: string;
}

export function MessageQuotes(props: MessageQuotesProps): ReactNode {
  const { id, text } = props.message;
  const ids = useMemo(
    () => quotedIdsOf({ origin: globalThis.location.origin, text }).filter((quoted) => quoted !== id),
    [id, text],
  );
  return ids.map((quoted) => <QuotedMessage id={quoted} key={quoted} me={props.me} />);
}
