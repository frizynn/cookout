import type { Character } from "./character.ts";
import { CharacterImage } from "./character-image.tsx";
import type { ReactNode } from "react";
import { useCallback } from "react";

const COUNTED_FROM = 1;

interface CharacterOptionParts {
  readonly character: Character;
  readonly index: number;
  readonly group: string;
  readonly picked: boolean;
  readonly onPick: (index: number) => void;
}

function ringOf(picked: boolean): string {
  if (picked) {
    return "ring-2 ring-foreground ring-offset-2 ring-offset-background";
  }
  return "ring-1 ring-border hover:ring-muted-foreground";
}

export function CharacterOption(parts: CharacterOptionParts): ReactNode {
  const { character, index, onPick } = parts;
  const handleChange = useCallback(() => {
    onPick(index);
  }, [index, onPick]);
  return (
    <label
      className={`relative block aspect-square cursor-pointer overflow-hidden rounded-[28%] transition-[box-shadow,scale] duration-150 active:scale-95 has-focus-visible:ring-2 has-focus-visible:ring-muted-foreground ${ringOf(parts.picked)}`}
    >
      <input
        aria-label={`Character ${String(index + COUNTED_FROM)}`}
        checked={parts.picked}
        className="sr-only"
        name={parts.group}
        onChange={handleChange}
        type="radio"
        value={index}
      />
      <CharacterImage agent frame="h-full w-full" look={character.style} seed={character.seed} testId="character" />
    </label>
  );
}
