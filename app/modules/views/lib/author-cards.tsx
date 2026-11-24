import { IdentityCards, MessageKeys, PersonKeysArea } from "../../design-system/index.tsx";
import { messageShortcutsOf, personKeysOf } from "./person-keys.ts";
import type { BoardStore } from "../../board/index.ts";
import type { Keymap } from "../../keymap/index.ts";
import type { ReactNode } from "react";
import { createIdentityCards } from "./identity-cards.ts";
import { useMemo } from "react";

interface AuthorCardsProps {
  readonly boardStore: BoardStore;
  readonly keymap: Keymap;
  readonly children: ReactNode;
}

export function AuthorCards(props: AuthorCardsProps): ReactNode {
  const { boardStore, keymap } = props;
  const cards = useMemo(() => createIdentityCards(boardStore), [boardStore]);
  const keys = useMemo(() => personKeysOf(keymap), [keymap]);
  const shortcuts = useMemo(() => messageShortcutsOf(keymap), [keymap]);
  return (
    <IdentityCards value={cards}>
      <PersonKeysArea keys={keys}>
        <MessageKeys value={shortcuts}>{props.children}</MessageKeys>
      </PersonKeysArea>
    </IdentityCards>
  );
}
