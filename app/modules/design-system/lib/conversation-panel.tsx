import { BackLink } from "./back-link.tsx";
import type { PanelAction } from "./panel-action-button.tsx";
import { PanelActionButton } from "./panel-action-button.tsx";
import type { ReactNode } from "react";

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
          <a
            className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            href={parts.openHref}
          >
            {parts.openLabel}
          </a>
        )}
      </header>
      {parts.children}
    </aside>
  );
}
