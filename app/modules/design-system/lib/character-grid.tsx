import { CHARACTER_INDEXES, characterAt } from "./character.ts";
import { CharacterOption } from "./character-option.tsx";
import type { CharacterRound } from "./character.ts";
import type { ReactNode } from "react";
import { useId } from "react";

interface CharacterGridParts {
  readonly shown: CharacterRound;
  readonly picked: number | null;
  readonly onPick: (index: number) => void;
}

export function CharacterGrid(parts: CharacterGridParts): ReactNode {
  const group = useId();
  const handlePick = parts.onPick;
  return (
    <div aria-label="Character" className="grid grid-cols-8 gap-2 max-md:grid-cols-4 max-md:gap-3" role="radiogroup">
      {CHARACTER_INDEXES.map((index) => (
        <CharacterOption
          character={characterAt({ ...parts.shown, index })}
          group={group}
          index={index}
          key={characterAt({ ...parts.shown, index }).seed}
          onPick={handlePick}
          picked={parts.picked === index}
        />
      ))}
    </div>
  );
}
