import { BackLink } from "./back-link.tsx";
import { CONVERSATION_KEYS } from "./conversation-keys.ts";
import type { PanelAction } from "./panel-action-button.tsx";
import { PanelActionButton } from "./panel-action-button.tsx";
import type { ReactNode } from "react";
import { ShortcutLink } from "./shortcut-link.tsx";

const NO_ACTIONS: readonly PanelAction[] = [];

interface ConversationPanelParts {
  readonly label: string;
  readonly detail: string;
  readonly backHref: string;
  readonly backLabel: string;
  readonly openHref: string | null;
  readonly openLabel: string;
  readonly actions?: readonly PanelAction[];
  readonly children: ReactNode;
}

export function ConversationPanel(parts: ConversationPanelParts): ReactNode {
  return (
    <aside
      aria-label={parts.label}
      className="flex w-full min-w-0 flex-col bg-card md:w-md md:shrink-0 md:border-l lg:w-xl"
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-5">
        <BackLink href={parts.backHref} label={parts.backLabel} />
        <h2 className="text-sm font-semibold">{parts.label}</h2>
        <span className="flex-1 font-mono text-xs text-muted-foreground">{parts.detail}</span>
        {(parts.actions ?? NO_ACTIONS).map((action) => (
          <PanelActionButton action={action} key={action.label} />
        ))}
        {parts.openHref !== null && (
          <ShortcutLink href={parts.openHref} label={parts.openLabel} shortcut={CONVERSATION_KEYS.open} />
        )}
      </header>
      {parts.children}
    </aside>
  );
}
