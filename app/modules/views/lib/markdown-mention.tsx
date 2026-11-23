import { Mention } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";
import { isIdentityName } from "../../identities/index.ts";

interface MarkdownMentionProps {
  readonly "data-mention"?: string | undefined;
  readonly "data-name"?: string | undefined;
  readonly children?: ReactNode | undefined;
}

export function MarkdownMention(props: MarkdownMentionProps): ReactNode {
  const name = props["data-name"] ?? "";
  const mention = <Mention mine={props["data-mention"] === "mine"}>{props.children}</Mention>;
  if (!isIdentityName(name)) {
    return mention;
  }
  return (
    <a className="hover:underline" href={hrefOf({ identity: name, name: "profile" })}>
      {mention}
    </a>
  );
}
