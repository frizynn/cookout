import type { ReactNode } from "react";

interface MarkdownLinkProps {
  readonly href?: string | undefined;
  readonly children?: ReactNode | undefined;
}

export function MarkdownLink(props: MarkdownLinkProps): ReactNode {
  return (
    <a
      className="text-foreground underline underline-offset-2"
      href={props.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {props.children}
    </a>
  );
}
