import type { CharacterStyle } from "./character.ts";
import type { ReactNode } from "react";
import { characterUri } from "./character.ts";

interface CharacterImageParts {
  readonly seed: string;
  readonly look: CharacterStyle;
  readonly frame: string;
  readonly agent: boolean;
  readonly testId: "avatar" | "character" | "replier-avatar";
}

export function CharacterImage(parts: CharacterImageParts): ReactNode {
  const character = { seed: parts.seed, style: parts.look };
  return (
    <img
      alt=""
      aria-hidden="true"
      className={parts.frame}
      data-agent={parts.agent}
      data-character={`${parts.look}:${parts.seed}`}
      data-testid={parts.testId}
      decoding="async"
      draggable={false}
      src={characterUri(character)}
    />
  );
}
