import type { Keymap } from "../../keymap/index.ts";
import { createRegionKeys } from "./regions.ts";
import { useEffect } from "react";

export function useRegionKeys(keymap: Keymap): void {
  useEffect(() => {
    const regions = createRegionKeys();
    const { document } = globalThis;
    function remember(event: Readonly<Event>): void {
      regions.remember(event.target);
    }
    document.addEventListener("focusin", remember);
    const unbind = keymap.bind({ actions: regions.actions, scope: "everywhere" });
    return (): void => {
      document.removeEventListener("focusin", remember);
      unbind();
    };
  }, [keymap]);
}
