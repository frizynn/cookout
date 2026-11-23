import type { MessageMenuParts } from "./menu-parts.ts";
import type { RefObject } from "react";
import { useCallback } from "react";
import { useListener } from "./use-listener.ts";

export function useRightClick(menu: MessageMenuParts | null): RefObject<HTMLElement | null> {
  const opened = useCallback(
    (event: MouseEvent) => {
      if (menu !== null) {
        event.preventDefault();
        menu.onOpen();
      }
    },
    [menu],
  );
  return useListener<HTMLElement, "contextmenu">({ listener: opened, type: "contextmenu" });
}
