import { useCallback, useRef } from "react";
import type { PointerEvent } from "react";

const FINGERS: ReadonlySet<string> = new Set(["touch", "pen"]);

type Release = Readonly<Pick<PointerEvent, "pointerType" | "preventDefault">>;

interface HeldRelease {
  readonly onPointerDown: () => void;
  readonly onPointerUp: (event: Release) => void;
}

export function useHeldRelease(): HeldRelease {
  const pressed = useRef(false);
  const onPointerDown = useCallback(() => {
    pressed.current = true;
  }, []);
  const onPointerUp = useCallback((event: Release) => {
    if (FINGERS.has(event.pointerType) && !pressed.current) {
      event.preventDefault();
    }
    pressed.current = false;
  }, []);
  return { onPointerDown, onPointerUp };
}

export type { Release };
