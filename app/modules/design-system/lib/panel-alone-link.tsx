import { LandingContext } from "../../landing/index.ts";
import type { PanelAloneParts } from "./panel-alone-parts.ts";
import type { ReactNode } from "react";
import { useContext } from "react";

const OUT = "M9.5 3.5h3v3M12.5 3.5l-4 4M6.5 12.5h-3v-3M3.5 12.5l4-4";
const IN = "M8.5 7.5h3M8.5 7.5v-3M8.5 7.5l4-4M7.5 8.5h-3M7.5 8.5v3M7.5 8.5l-4 4";

function pathOf(alone: boolean): string {
  if (alone) {
    return IN;
  }
  return OUT;
}

export function PanelAloneLink(parts: PanelAloneParts): ReactNode {
  const handleClick = useContext(LandingContext).askOnFollow;
  return (
    <a
      aria-label={parts.label}
      className="hidden rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground md:inline-flex"
      href={parts.href}
      onClick={handleClick}
      title={parts.label}
    >
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        viewBox="0 0 16 16"
      >
        <path d={pathOf(parts.alone)} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
