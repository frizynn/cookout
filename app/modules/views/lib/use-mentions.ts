import { useCallback, useMemo } from "react";
import type { Draft } from "../../composer/index.ts";
import type { Identity } from "../../sdk/index.ts";

const NONE = 0;
const AT_SIGN = "@";

interface MentionsOf {
  readonly draft: Draft;
  readonly suggestions: readonly Identity[];
}

interface Mentions {
  readonly mentions: readonly string[];
  readonly choosing: boolean;
  readonly handleChoose: (option: string) => void;
}

function useMentions({ draft, suggestions }: MentionsOf): Mentions {
  const handleChoose = useCallback(
    (option: string) => {
      draft.choose(option.slice(AT_SIGN.length));
    },
    [draft],
  );
  const mentions = useMemo(() => suggestions.map((identity) => `${AT_SIGN}${identity.name}`), [suggestions]);
  return { choosing: mentions.length > NONE, handleChoose, mentions };
}

export { useMentions };
