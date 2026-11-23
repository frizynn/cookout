import { useEffect, useRef } from "react";
import type { RefObject } from "react";

type Heard = "contextmenu" | "keydown";

interface Listening<Type extends Heard> {
  readonly type: Type;
  readonly listener: (event: HTMLElementEventMap[Type]) => void;
}

function useListener<Element extends HTMLElement, Type extends Heard>({
  listener,
  type,
}: Listening<Type>): RefObject<Element | null> {
  const element = useRef<Element>(null);
  useEffect(() => {
    const shown = element.current;
    function stop(): void {
      if (shown !== null) {
        shown.removeEventListener(type, listener);
      }
    }
    if (shown !== null) {
      shown.addEventListener(type, listener);
    }
    return stop;
  }, [type, listener]);
  return element;
}

export { useListener };
