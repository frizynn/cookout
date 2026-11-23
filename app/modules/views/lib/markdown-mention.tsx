import { Mention } from "../../design-system/index.tsx";
import type { ReactNode } from "react";

interface MarkdownMentionProps {
  readonly "data-mention"?: string | undefined;
  readonly children?: ReactNode | undefined;
}

export function MarkdownMention(props: MarkdownMentionProps): ReactNode {
  return <Mention mine={props["data-mention"] === "mine"}>{props.children}</Mention>;
}
