const COPIED = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "wordSpacing",
  "tabSize",
  "textIndent",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
] as const;

const NONE = 0;

function pixels(length: string): number {
  return Number(length.replace("px", ""));
}

function boxBeside(mirror: unknown): HTMLTextAreaElement | null {
  if (mirror instanceof HTMLElement && mirror.nextElementSibling instanceof HTMLTextAreaElement) {
    return mirror.nextElementSibling;
  }
  return null;
}

function scrollbarOf(box: unknown): number {
  if (!(box instanceof HTMLTextAreaElement)) {
    return NONE;
  }
  const look = getComputedStyle(box);
  return box.offsetWidth - box.clientWidth - pixels(look.borderLeftWidth) - pixels(look.borderRightWidth);
}

function followBox(mirror: unknown): void {
  const box = boxBeside(mirror);
  if (box === null || !(mirror instanceof HTMLElement)) {
    return;
  }
  const look = getComputedStyle(box);
  for (const property of COPIED) {
    mirror.style[property] = look[property];
  }
  mirror.style.paddingRight = `${String(pixels(look.paddingRight) + scrollbarOf(box))}px`;
  mirror.scrollTop = box.scrollTop;
}

function watchBox(mirror: unknown): () => void {
  const box = boxBeside(mirror);
  function follow(): void {
    followBox(mirror);
  }
  if (box !== null) {
    box.addEventListener("scroll", follow, { passive: true });
  }
  return (): void => {
    if (box !== null) {
      box.removeEventListener("scroll", follow);
    }
  };
}

export { followBox, watchBox };
