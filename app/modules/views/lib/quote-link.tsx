import type { MessageId } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { messageHrefOf } from "./message-href.ts";
import { useQuote } from "./use-quote.ts";

interface QuoteLinkProps {
  readonly id: MessageId;
  readonly children?: ReactNode | undefined;
}

export function QuoteLink(props: QuoteLinkProps): ReactNode {
  const quoted = useQuote(props.id);
  if (quoted === null || quoted === "reading") {
    return props.children;
  }
  return (
    <a className="text-foreground underline underline-offset-2" href={messageHrefOf(quoted)}>
      {props.children}
    </a>
  );
}
