import { focusInPlace, scrollsToReveal } from "./focus-in-place.ts";
import { useEffect } from "react";

const SETTLE_MS = 1000;
const NO_FRAME = 0;
const UNZOOMED = 1;
const HEIGHT = "--visible-height";
const TOP = "--visible-top";
const KEYBOARD = "data-keyboard";
const TEXT_FIELD =
  'textarea, select, [contenteditable=""], [contenteditable="true"], input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="file"], [type="range"], [type="color"])';
const AREA_EVENTS = ["resize", "scroll"] as const;
const PAGE_EVENTS = ["focusin", "focusout", "visibilitychange"] as const;
const WINDOW_EVENTS = ["resize", "pageshow", "orientationchange"] as const;

interface Settling {
  readonly settle: () => void;
  readonly stop: () => void;
}

function viewport(): VisualViewport | null {
  return globalThis.visualViewport ?? null;
}

function holdsKeyboard(): boolean {
  const element = globalThis.document.activeElement;
  return element !== null && (element.matches(TEXT_FIELD) || element instanceof HTMLIFrameElement);
}

function written(name: string, value: string): void {
  const { style } = globalThis.document.documentElement;
  if (style.getPropertyValue(name) !== value) {
    style.setProperty(name, value);
  }
}

function forgotten(name: string): void {
  globalThis.document.documentElement.style.removeProperty(name);
}

function markKeyboard(held: boolean): void {
  globalThis.document.documentElement.toggleAttribute(KEYBOARD, held);
}

function heightWhile(held: boolean, height: number): void {
  if (held) {
    written(HEIGHT, `${String(height)}px`);
  } else {
    forgotten(HEIGHT);
  }
}

function measure(): void {
  const area = viewport();
  const held = holdsKeyboard();
  if (area === null || area.scale !== UNZOOMED) {
    if (!held) {
      forgotten(HEIGHT);
      markKeyboard(held);
    }
    return;
  }
  heightWhile(held, area.height);
  written(TOP, `${String(area.offsetTop)}px`);
  markKeyboard(held);
}

function settling(): Settling {
  let frame = NO_FRAME;
  let until = NO_FRAME;
  function tick(): void {
    frame = NO_FRAME;
    measure();
    if (performance.now() < until) {
      frame = requestAnimationFrame(tick);
    }
  }
  return {
    settle: () => {
      until = performance.now() + SETTLE_MS;
      if (frame === NO_FRAME) {
        frame = requestAnimationFrame(tick);
      }
    },
    stop: () => {
      cancelAnimationFrame(frame);
    },
  };
}

function listened(settle: () => void): AbortController {
  const control = new AbortController();
  function on(target: EventTarget | null, types: readonly string[]): void {
    if (target === null) {
      return;
    }
    for (const type of types) {
      target.addEventListener(type, settle, { signal: control.signal });
    }
  }
  on(viewport(), AREA_EVENTS);
  on(globalThis.document, PAGE_EVENTS);
  on(globalThis, WINDOW_EVENTS);
  return control;
}

function focusedInPlace(): AbortController {
  if (scrollsToReveal()) {
    return focusInPlace();
  }
  return new AbortController();
}

function follow(): () => void {
  const { settle, stop } = settling();
  const control = listened(settle);
  const inPlace = focusedInPlace();
  measure();
  return () => {
    control.abort();
    inPlace.abort();
    stop();
    forgotten(HEIGHT);
    forgotten(TOP);
    markKeyboard(false);
  };
}

function useVisibleArea(): void {
  useEffect(follow, []);
}

export { useVisibleArea };
