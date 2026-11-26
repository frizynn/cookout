import { createElement, useCallback } from "react";
import type { MenuChoice as Choice } from "./menu-parts.ts";
import { MENU_ITEM } from "./menu-style.ts";
import { MenuChoiceText } from "./menu-choice-text.tsx";
import type { ReactNode } from "react";
import type { Release } from "./use-held-release.ts";
import { useHeldRelease } from "./use-held-release.ts";

interface ItemShape {
  readonly asChild: true;
  readonly onPointerDown?: () => void;
  readonly onPointerUp?: (event: Release) => void;
  readonly onSelect?: () => void;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}

type Item = (props: ItemShape) => ReactNode;

interface MenuChoiceParts {
  readonly choice: Choice;
  readonly item: Item;
  readonly onChoose: (action: () => void) => void;
}

const NO_KEYS = "";

function keysOf(choice: Choice): string {
  const keys = choice.keys ?? null;
  if (keys === null) {
    return NO_KEYS;
  }
  return keys.keys;
}

export function MenuChoice(parts: MenuChoiceParts): ReactNode {
  const { choice, onChoose } = parts;
  const RadixItem = parts.item;
  const release = useHeldRelease();
  const handlePointerDown = release.onPointerDown;
  const handlePointerUp = release.onPointerUp;
  const handleSelect = useCallback(() => {
    if (choice.onSelect !== null) {
      onChoose(choice.onSelect);
    }
  }, [choice, onChoose]);
  if (choice.href !== null) {
    return (
      <RadixItem asChild onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        <a aria-keyshortcuts={keysOf(choice)} className={MENU_ITEM} href={choice.href}>
          {createElement(MenuChoiceText, { choice })}
        </a>
      </RadixItem>
    );
  }
  return (
    <RadixItem
      asChild
      disabled={choice.disabled ?? false}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onSelect={handleSelect}
    >
      <div aria-keyshortcuts={keysOf(choice)} className={MENU_ITEM}>
        {createElement(MenuChoiceText, { choice })}
      </div>
    </RadixItem>
  );
}
