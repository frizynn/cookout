import { useCallback, useRef } from "react";
import type { PointerEvent } from "react";

const MOUSE = "mouse";

type Press = Readonly<Pick<PointerEvent, "pointerType" | "preventDefault">>;

interface TapOpen {
  readonly onClick: () => void;
  readonly onPointerDown: (event: Press) => void;
}

export function useTapOpen(onTap: () => void): TapOpen {
  const pointer = useRef(MOUSE);
  const onPointerDown = useCallback((event: Press) => {
    pointer.current = event.pointerType;
    if (event.pointerType !== MOUSE) {
      event.preventDefault();
    }
  }, []);
  const onClick = useCallback(() => {
    if (pointer.current !== MOUSE) {
      pointer.current = MOUSE;
      onTap();
    }
  }, [onTap]);
  return { onClick, onPointerDown };
}
