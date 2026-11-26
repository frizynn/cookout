import type { MessageId } from "../../sdk/index.ts";
import { QuoteOf } from "./quote-of.tsx";
import type { ReactNode } from "react";
import { useQuote } from "./use-quote.ts";

interface QuotedMessageProps {
  readonly id: MessageId;
  readonly me: string;
}

export function QuotedMessage(props: QuotedMessageProps): ReactNode {
  const quoted = useQuote(props.id);
  if (quoted === null || quoted === "reading") {
    return null;
  }
  return <QuoteOf me={props.me} message={quoted} />;
}
