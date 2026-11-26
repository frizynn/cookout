import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./button-look.ts";
import { STYLE_CHOICES, characterAt, isCharacterStyle } from "./character.ts";
import { useCallback, useMemo } from "react";
import { ButtonRow } from "./button-row.tsx";
import { CharacterGrid } from "./character-grid.tsx";
import type { CharacterPickerParts } from "./parts.ts";
import type { CharacterRound } from "./character.ts";
import { ChoiceGroup } from "./choice-group.tsx";
import type { ReactNode } from "react";
import { characterPng } from "./character-png.ts";

const TEXT = { save: "Save avatar", saving: "Saving…", shuffle: "Shuffle", style: "Style" } as const;

function shownOf(parts: CharacterPickerParts): CharacterRound {
  if (isCharacterStyle(parts.look)) {
    return { round: parts.round, seed: parts.seed, style: parts.look };
  }
  return { round: parts.round, seed: parts.seed, style: "bot" };
}

function saveText(saving: boolean): string {
  if (saving) {
    return TEXT.saving;
  }
  return TEXT.save;
}

export function CharacterPicker(parts: CharacterPickerParts): ReactNode {
  const { onSave, picked } = parts;
  const shown = useMemo(() => shownOf(parts), [parts]);
  const handleChooseLook = parts.onChooseLook;
  const handlePick = parts.onPick;
  const handleShuffle = parts.onShuffle;
  const handleSave = useCallback(() => {
    if (picked !== null) {
      onSave(characterPng(characterAt({ ...shown, index: picked })));
    }
  }, [onSave, picked, shown]);
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-3 text-xs font-medium text-foreground max-md:text-[13px]">{parts.label}</legend>
      <ChoiceGroup choices={STYLE_CHOICES} label={TEXT.style} onChoose={handleChooseLook} value={shown.style} />
      <CharacterGrid onPick={handlePick} picked={picked} shown={shown} />
      <ButtonRow>
        <button className={SECONDARY_BUTTON} onClick={handleShuffle} type="button">
          {TEXT.shuffle}
        </button>
        <button
          className={PRIMARY_BUTTON}
          disabled={picked === null || parts.saving}
          onClick={handleSave}
          type="button"
        >
          {saveText(parts.saving)}
        </button>
      </ButtonRow>
      {parts.children}
    </fieldset>
  );
}
