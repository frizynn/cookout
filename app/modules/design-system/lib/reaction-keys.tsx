import type { ReactNode } from "react";
import type { ReactionChoice } from "./menu-parts.ts";
import { ReactionKey } from "./reaction-key.tsx";

interface ReactionKeysParts {
  readonly reactions: readonly ReactionChoice[];
}

export function ReactionKeys(parts: ReactionKeysParts): ReactNode {
  return parts.reactions
    .filter((choice) => !choice.inHoverBar)
    .map((choice) => <ReactionKey choice={choice} key={choice.symbol} />);
}
