import type { ActionMenuParts } from "./menu-parts.ts";
import { CloseLink } from "./close-link.tsx";
import { PanelAloneLink } from "./panel-alone-link.tsx";
import type { PanelAloneParts } from "./panel-alone-parts.ts";
import type { PanelIconAction } from "./panel-icon-button.tsx";
import { PanelIconButton } from "./panel-icon-button.tsx";
import { PanelTitle } from "./panel-title.tsx";
import type { ReactNode } from "react";

interface SidePanelHeaderParts {
  readonly label: string;
  readonly detail: string;
  readonly closeHref: string;
  readonly closeLabel: string;
  readonly menu?: ActionMenuParts | null | undefined;
  readonly action: PanelIconAction | null;
  readonly alone?: PanelAloneParts | null | undefined;
  readonly onClose?: (() => void) | null | undefined;
}

interface AloneLinks {
  readonly before: PanelAloneParts | null;
  readonly after: PanelAloneParts | null;
}

const NO_LINKS: AloneLinks = { after: null, before: null };

function aloneLinks(alone: PanelAloneParts | null): AloneLinks {
  if (alone === null) {
    return NO_LINKS;
  }
  if (alone.alone) {
    return { after: null, before: alone };
  }
  return { after: alone, before: null };
}

export function SidePanelHeader(parts: SidePanelHeaderParts): ReactNode {
  const { after, before } = aloneLinks(parts.alone ?? null);
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-5 max-md:px-2.5">
      <PanelTitle detail={parts.detail} label={parts.label} menu={parts.menu ?? null} />
      {parts.action !== null && <PanelIconButton action={parts.action} />}
      <PanelAloneLink link={before} />
      <CloseLink href={parts.closeHref} label={parts.closeLabel} onFollow={parts.onClose ?? null} />
      <PanelAloneLink link={after} />
    </header>
  );
}

export type { SidePanelHeaderParts };
