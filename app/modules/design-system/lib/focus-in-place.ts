const APPLE = /iPhone|iPad|iPod|Mac/u;
const NO_TOUCH = 0;
const NO_TAB_STOP = -1;
const TEXT_FIELD =
  'textarea:enabled, [contenteditable=""], [contenteditable="true"], input:enabled:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="file"], [type="range"], [type="color"])';

type Press = Readonly<Pick<PointerEvent, "pointerType" | "target">>;
type Leaving = Readonly<Pick<FocusEvent, "relatedTarget" | "target">>;

function fieldUnder(target: unknown): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const field = target.closest(TEXT_FIELD);
  if (field instanceof HTMLElement && field !== globalThis.document.activeElement) {
    return field;
  }
  return null;
}

function parked(): void {
  const { activeElement, body } = globalThis.document;
  if (activeElement === null || activeElement === body) {
    body.tabIndex = NO_TAB_STOP;
    body.focus({ preventScroll: true });
  }
}

function focusInPlace(): AbortController {
  const control = new AbortController();
  const options = { capture: true, signal: control.signal };
  let tapped: HTMLElement | null = null;
  function pressed(event: Press): void {
    tapped = null;
    const field = fieldUnder(event.target);
    if (event.pointerType !== "mouse" && field !== null) {
      tapped = field;
      parked();
    }
  }
  function left(event: Leaving): void {
    if (event.target === globalThis.document.body) {
      globalThis.document.body.removeAttribute("tabindex");
    }
    if (tapped !== null && event.relatedTarget === tapped) {
      const field = tapped;
      tapped = null;
      field.focus({ preventScroll: true });
    }
  }
  globalThis.document.addEventListener("pointerdown", pressed, options);
  globalThis.document.addEventListener("blur", left, options);
  return control;
}

function scrollsToReveal(): boolean {
  return APPLE.test(globalThis.navigator.platform) && globalThis.navigator.maxTouchPoints > NO_TOUCH;
}

export { focusInPlace, scrollsToReveal };
