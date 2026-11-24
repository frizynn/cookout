const WIDE = "(min-width: 48rem)";

function isNarrowWindow(): boolean {
  return typeof globalThis.matchMedia === "function" && !globalThis.matchMedia(WIDE).matches;
}

export { isNarrowWindow };
