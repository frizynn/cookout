import type { PageFocusAdapter } from "./page-focus.ts";

const EVENTS = ["focus", "blur"] as const;

function documentFocusAdapter(): PageFocusAdapter {
  return {
    focused: () => globalThis.document.visibilityState === "visible" && globalThis.document.hasFocus(),
    listen: (onChange) => {
      globalThis.document.addEventListener("visibilitychange", onChange);
      for (const event of EVENTS) {
        globalThis.addEventListener(event, onChange);
      }
      return () => {
        globalThis.document.removeEventListener("visibilitychange", onChange);
        for (const event of EVENTS) {
          globalThis.removeEventListener(event, onChange);
        }
      };
    },
  };
}

export { documentFocusAdapter };
