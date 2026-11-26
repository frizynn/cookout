const TOUCH = "(pointer: coarse)";

function isTouchScreen(): boolean {
  return typeof globalThis.matchMedia === "function" && globalThis.matchMedia(TOUCH).matches;
}

export { isTouchScreen };
