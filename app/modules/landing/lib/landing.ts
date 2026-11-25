import { createContext } from "react";

const WAIT_MS = 10_000;
const WATCHED = { childList: true, subtree: true } as const;

interface Landing {
  readonly ask: () => void;
  readonly askOnFollow: () => void;
  readonly settle: (target: string) => void;
  readonly watch: (target: string) => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => boolean;
}

function isLost(): boolean {
  const { activeElement, body } = globalThis.document;
  return activeElement === null || activeElement === body;
}

function blurred(): void {
  const { activeElement } = globalThis.document;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
}

function landedOn(target: string, stop: () => void): () => void {
  return () => {
    const element = globalThis.document.querySelector(target);
    if (element instanceof HTMLElement && isLost()) {
      stop();
      element.focus();
    }
  };
}

function watched(target: string): AbortController {
  const control = new AbortController();
  function stop(): void {
    control.abort();
  }
  const tried = landedOn(target, stop);
  const observer = new MutationObserver(tried);
  const timer = globalThis.setTimeout(stop, WAIT_MS);
  control.signal.addEventListener("abort", () => {
    observer.disconnect();
    globalThis.clearTimeout(timer);
  });
  globalThis.document.addEventListener("focusin", stop, { capture: true, signal: control.signal });
  observer.observe(globalThis.document.body, WATCHED);
  tried();
  return control;
}

function createLanding(): Landing {
  const listeners = new Set<() => void>();
  let watching = new AbortController();
  let following = new AbortController();
  let pending = false;
  function told(): void {
    for (const listener of listeners) {
      listener();
    }
  }
  function watch(target: string): void {
    watching.abort();
    watching = watched(target);
  }
  function ask(): void {
    following.abort();
    blurred();
    pending = true;
    told();
  }
  return {
    ask,
    askOnFollow: () => {
      following.abort();
      following = new AbortController();
      globalThis.addEventListener("hashchange", ask, { once: true, signal: following.signal });
    },
    settle: (target) => {
      if (pending) {
        pending = false;
        watch(target);
        told();
      }
    },
    snapshot: () => pending,
    subscribe: (listener) => {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
    watch,
  };
}

const LandingContext = createContext<Landing>(createLanding());

export { type Landing, LandingContext, createLanding };
