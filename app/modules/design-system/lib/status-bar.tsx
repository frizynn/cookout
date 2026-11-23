import type { ReactNode } from "react";
import type { StatusBarParts } from "./parts.ts";

export function StatusBar(parts: StatusBarParts): ReactNode {
  return (
    <output aria-label={parts.label} aria-live="polite" className="block shrink-0">
      {parts.shown && (
        <span className="block border-b border-mention-bar bg-mention-bg px-4 py-1.5 text-center text-xs text-mention-fg">
          {parts.children}
        </span>
      )}
    </output>
  );
}
