import { useEffect, useRef } from "react";
import type { RefObject } from "react";

function useFocusOnOpen(focused: boolean): RefObject<HTMLTextAreaElement | null> {
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = box.current;
    if (focused && element !== null) {
      element.focus();
    }
  }, [focused]);
  return box;
}

export { useFocusOnOpen };
