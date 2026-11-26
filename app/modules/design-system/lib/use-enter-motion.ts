import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const MOVES = "(width < 48rem) and (prefers-reduced-motion: no-preference)";
const FROM: Keyframe = { opacity: 0, transform: "translateX(2.5rem)" };
const TO: Keyframe = { opacity: 1, transform: "none" };
const TIMING: KeyframeAnimationOptions = { duration: 260, easing: "cubic-bezier(0.32, 0.72, 0, 1)" };

function moves(): boolean {
  return (
    typeof Element.prototype.animate === "function" &&
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia(MOVES).matches
  );
}

export function useEnterMotion(shown: string): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement>(null);
  const last = useRef<string | null>(null);
  useEffect(() => {
    const element = ref.current;
    const changed = last.current !== shown;
    last.current = shown;
    if (changed && element !== null && moves()) {
      element.animate([FROM, TO], TIMING);
    }
  }, [shown]);
  return ref;
}
