import type { ReactNode } from "react";
import { linkedMessageOf } from "./quoted-ids.ts";

interface MarkdownLinkProps {
  readonly href?: string | undefined;
  readonly children?: ReactNode | undefined;
}

type Target = "_blank" | "_self";

function isThisBoard(href: string | undefined): boolean {
  const here = globalThis.location;
  return typeof href === "string" && URL.canParse(href, here.href) && new URL(href, here.href).origin === here.origin;
}

function targetOf(href: string | undefined): Target {
  if (isThisBoard(href)) {
    return "_self";
  }
  return "_blank";
}

function labelOf(props: MarkdownLinkProps): ReactNode {
  const href = props.href ?? "";
  const linked = linkedMessageOf({ href, origin: globalThis.location.origin });
  if (linked === null || props.children !== href) {
    return props.children;
  }
  return `msg ${String(linked.id)} in #${linked.channel}`;
}

export function MarkdownLink(props: MarkdownLinkProps): ReactNode {
  return (
    <a
      className="text-foreground underline underline-offset-2"
      href={props.href}
      rel="noopener noreferrer"
      target={targetOf(props.href)}
    >
      {labelOf(props)}
    </a>
  );
}
