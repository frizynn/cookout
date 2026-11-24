import type { PersonActs, PersonKeysShared } from "./person-keys-parts.ts";
import { useEffect } from "react";

interface PersonKeysOf {
  readonly keys: PersonKeysShared | null;
  readonly person: { readonly acts: PersonActs } | null;
  readonly within: () => Element | null;
}

function bound({ keys, person, within }: PersonKeysOf): readonly (() => void)[] {
  if (keys === null || person === null) {
    return [];
  }
  return [keys.bind({ acts: person.acts, within })];
}

function usePersonKeys({ keys, person, within }: PersonKeysOf): void {
  useEffect(() => {
    const unbinds = bound({ keys, person, within });
    return (): void => {
      for (const unbind of unbinds) {
        unbind();
      }
    };
  }, [keys, person, within]);
}

export { usePersonKeys };
