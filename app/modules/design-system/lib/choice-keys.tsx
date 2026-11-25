import type { MenuChoice } from "./menu-parts.ts";
import type { ReactNode } from "react";

interface ChoiceKeysParts {
  readonly choices: readonly MenuChoice[];
}

interface Keyed {
  readonly label: string;
  readonly keys: string;
  readonly onSelect: () => void;
}

const NO_KEYS = "";

function keysOf(choice: MenuChoice): string {
  const keys = choice.keys ?? null;
  if (keys === null) {
    return NO_KEYS;
  }
  return keys.keys;
}

function keyedOf(choice: MenuChoice): readonly Keyed[] {
  const keys = keysOf(choice);
  if (choice.href !== null || choice.disabled === true || keys === NO_KEYS) {
    return [];
  }
  return [{ keys, label: choice.label, onSelect: choice.onSelect }];
}

export function ChoiceKeys(parts: ChoiceKeysParts): ReactNode {
  return parts.choices.flatMap(keyedOf).map((choice) => {
    const handleSelect = choice.onSelect;
    return (
      <button
        aria-keyshortcuts={choice.keys}
        aria-label={choice.label}
        hidden
        key={choice.label}
        onClick={handleSelect}
        type="button"
      />
    );
  });
}
