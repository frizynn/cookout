import { QuoteLink } from "./quote-link.tsx";
import type { ReactNode } from "react";
import { quotedIdOf } from "./quoted-ids.ts";

interface MarkdownQuoteProps {
  readonly "data-quote"?: string | undefined;
  readonly children?: ReactNode | undefined;
}

export function MarkdownQuote(props: MarkdownQuoteProps): ReactNode {
  const id = quotedIdOf(props["data-quote"] ?? "");
  if (id === null) {
    return props.children;
  }
  return <QuoteLink id={id}>{props.children}</QuoteLink>;
}
