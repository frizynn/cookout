import { Mention } from "../../design-system/index.tsx";
import type { ReactNode } from "react";

const MENTION = /(?<mention>(?<![\w.@-])@[a-z0-9-]+)/u;
const AT_SIGN = "@";
const EVERY_OTHER = 2;
const PLAIN = 0;

interface MentionTextProps {
  readonly text: string;
  readonly me: string;
}

export function MentionText(props: MentionTextProps): ReactNode {
  const shown: ReactNode[] = [];
  let offset = 0;
  for (const [index, part] of props.text.split(MENTION).entries()) {
    if (index % EVERY_OTHER === PLAIN) {
      shown.push(part);
    } else {
      shown.push(
        <Mention key={offset} mine={part === `${AT_SIGN}${props.me}`}>
          {part}
        </Mention>,
      );
    }
    offset += part.length;
  }
  return shown;
}
