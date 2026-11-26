import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

const NAME = "cookout";

export function AppShell(parts: Parts): ReactNode {
  return (
    <div className="h-dvh overflow-y-auto bg-background font-sans text-foreground">
      <header className="flex items-center border-b px-6 py-3">
        <span className="font-mono text-sm font-semibold tracking-tight">{NAME}</span>
      </header>
      <main className="flex">{parts.children}</main>
    </div>
  );
}
