import { useEffect } from "react";

const ESCAPE = "Escape";

function useEscapeTo(href: string): void {
  useEffect(() => {
    function escaped(event: KeyboardEvent): void {
      if (event.key === ESCAPE && !event.defaultPrevented) {
        globalThis.location.hash = href;
      }
    }
    globalThis.document.addEventListener("keydown", escaped);
    return (): void => {
      globalThis.document.removeEventListener("keydown", escaped);
    };
  }, [href]);
}

export { useEscapeTo };
