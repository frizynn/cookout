import { useCallback, useRef } from "react";
import type { PointerEvent } from "react";

const MOUSE = "mouse";
const FINGERS: ReadonlySet<string> = new Set(["touch", "pen"]);

type Press = Readonly<Pick<PointerEvent, "pointerType" | "preventDefault">>;

interface TapOpen {
  readonly onClick: () => void;
  readonly onPointerDown: (event: Press) => void;
}

export function useTapOpen(onTap: () => void): TapOpen {
  const pointer = useRef(MOUSE);
  const onPointerDown = useCallback((event: Press) => {
    pointer.current = event.pointerType;
    if (FINGERS.has(event.pointerType)) {
      event.preventDefault();
    }
  }, []);
  const onClick = useCallback(() => {
    if (FINGERS.has(pointer.current)) {
      pointer.current = MOUSE;
      onTap();
    }
  }, [onTap]);
  return { onClick, onPointerDown };
}
