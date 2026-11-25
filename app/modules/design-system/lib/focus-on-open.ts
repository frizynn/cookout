import { useEffect, useRef } from "react";
import type { RefObject } from "react";

function useFocusOnOpen<Focusable extends HTMLElement = HTMLTextAreaElement>(
  focused: boolean,
): RefObject<Focusable | null> {
  const box = useRef<Focusable>(null);
  useEffect(() => {
    const element = box.current;
    if (focused && element !== null) {
      element.focus();
    }
  }, [focused]);
  return box;
}

export { useFocusOnOpen };
