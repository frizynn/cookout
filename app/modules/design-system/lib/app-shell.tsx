import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";

const NAME = "cookout";
const INBOX = "Inbox";

export function AppShell(parts: Parts): ReactNode {
  return (
    <div className="min-h-screen bg-background font-mono text-foreground">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <a className="text-sm font-semibold tracking-tight" href={hrefOf({ name: "channels" })}>
          {NAME}
        </a>
        <a className="text-xs text-muted-foreground hover:text-foreground" href={hrefOf({ name: "inbox" })}>
          {INBOX}
        </a>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{parts.children}</main>
    </div>
  );
}
