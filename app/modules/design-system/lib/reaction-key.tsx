import type { ReactNode } from "react";
import type { ReactionChoice } from "./menu-parts.ts";

interface ReactionKeyParts {
  readonly choice: ReactionChoice;
}

export function ReactionKey(parts: ReactionKeyParts): ReactNode {
  const { choice } = parts;
  const handleReact = choice.onReact;
  return (
    <button
      aria-keyshortcuts={choice.key}
      aria-label={`React with ${choice.symbol}`}
      hidden
      onClick={handleReact}
      type="button"
    />
  );
}
