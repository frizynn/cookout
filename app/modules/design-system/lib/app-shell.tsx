import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";
import { useVisibleArea } from "./use-visible-area.ts";

const NAME = "cookout";

export function AppShell(parts: Parts): ReactNode {
  useVisibleArea();
  return (
    <div className="visible-frame overflow-y-auto overscroll-contain bg-background font-sans text-foreground">
      <header className="flex items-center border-b px-6 py-3">
        <span className="text-[15px] font-semibold tracking-tight">{NAME}</span>
      </header>
      <main className="flex">{parts.children}</main>
    </div>
  );
}
