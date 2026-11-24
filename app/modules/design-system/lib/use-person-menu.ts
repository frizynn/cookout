import type { ActionMenuParts, MenuChoice } from "./menu-parts.ts";
import { IdentityCardComposer, IdentityCards } from "./identity-card-parts.ts";
import type { PersonActs, PersonKeysShared } from "./person-keys-parts.ts";
import { useContext, useMemo, useSyncExternalStore } from "react";
import { PersonKeys } from "./person-keys-parts.ts";
import type { Shortcut } from "./shortcut.ts";

const TEXT = { copied: "Copied", copyName: "Copy name", message: "Message", viewProfile: "View profile" } as const;

interface PersonMenuOf {
  readonly name: string;
  readonly profileHref: string;
}

interface PersonMenu extends ActionMenuParts {
  readonly buttonLabel: string;
  readonly acts: PersonActs;
}

interface PersonChoicesOf extends PersonMenuOf {
  readonly compose: ((name: string) => void) | null;
  readonly deactivated: boolean;
  readonly keys: PersonKeysShared | null;
}

interface Choosing {
  readonly person: PersonChoicesOf;
  readonly copyName: () => void;
  readonly message: () => void;
}

function keysOf(keys: PersonKeysShared | null, act: keyof PersonActs): { readonly keys?: Shortcut } {
  if (keys === null) {
    return {};
  }
  return { keys: keys.shortcuts[act] };
}

function messageChoices({ message, person }: Choosing): readonly MenuChoice[] {
  if (person.compose === null) {
    return [];
  }
  return [
    {
      disabled: person.deactivated,
      href: null,
      icon: "message",
      label: TEXT.message,
      onSelect: message,
      ...keysOf(person.keys, "message"),
    },
  ];
}

async function copyAfter(previous: Promise<void>, text: string): Promise<void> {
  await previous;
  await globalThis.navigator.clipboard.writeText(text);
}

function personChoices(choosing: Choosing): readonly MenuChoice[] {
  const { person } = choosing;
  return [
    {
      href: person.profileHref,
      icon: "view-profile",
      label: TEXT.viewProfile,
      onSelect: null,
      ...keysOf(person.keys, "viewProfile"),
    },
    ...messageChoices(choosing),
    {
      href: null,
      icon: "copy-name",
      label: TEXT.copyName,
      onSelect: choosing.copyName,
      ...keysOf(person.keys, "copyName"),
    },
  ];
}

function viewProfile({ target }: { readonly target: EventTarget | null }): boolean {
  if (!(target instanceof HTMLAnchorElement)) {
    return false;
  }
  target.click();
  return true;
}

function personMenuOf(person: PersonChoicesOf): PersonMenu {
  const handle = `@${person.name}`;
  let copying = Promise.resolve();
  function copyName(): void {
    copying = copyAfter(copying, handle);
    if (person.keys !== null) {
      person.keys.announce(`${TEXT.copied} ${handle}`);
    }
  }
  function message(): void {
    if (person.compose !== null) {
      person.compose(person.name);
    }
  }
  const canMessage = person.compose !== null && !person.deactivated;
  const label = `${handle} actions`;
  return {
    acts: {
      copyName: () => {
        copyName();
        return true;
      },
      message: () => {
        if (canMessage) {
          message();
        }
        return canMessage;
      },
      viewProfile,
    },
    buttonLabel: label,
    choices: personChoices({ copyName, message, person }),
    label,
  };
}

function usePersonMenu({ name, profileHref }: PersonMenuOf): PersonMenu | null {
  const compose = useContext(IdentityCardComposer);
  const keys = useContext(PersonKeys);
  const source = useContext(IdentityCards);
  const card = useSyncExternalStore(source.subscribe, () => source.cardOf(name));
  const known = card !== null;
  const deactivated = known && card.deactivated;
  return useMemo(() => {
    if (!known) {
      return null;
    }
    return personMenuOf({ compose, deactivated, keys, name, profileHref });
  }, [compose, deactivated, keys, known, name, profileHref]);
}

export { usePersonMenu };
