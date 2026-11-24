import type { ReactionChoice } from "./menu-parts.ts";
import type { RefObject } from "react";
import { useEffect } from "react";
import { useReactionKeys } from "./use-reaction-keys.ts";

const CENTRE: ScrollIntoViewOptions = { block: "center" };

interface ArticleParts {
  readonly reactions: readonly ReactionChoice[];
  readonly linked: boolean;
}

export function useScrollWhenLinked({ linked, reactions }: ArticleParts): RefObject<HTMLElement | null> {
  const element = useReactionKeys(reactions);
  useEffect(() => {
    const shown = element.current;
    if (linked && shown !== null) {
      shown.scrollIntoView(CENTRE);
    }
  }, [element, linked]);
  return element;
}
