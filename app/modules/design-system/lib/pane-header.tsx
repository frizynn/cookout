import type { PaneHeaderParts } from "./parts.ts";
import type { ReactNode } from "react";

const HEADER_BUTTONS = [
  "max-md:[&_button]:min-h-9 max-md:[&_button]:rounded-full max-md:[&_button]:border-transparent",
  "max-md:[&_button:not([aria-pressed=true])]:bg-muted max-md:[&_button]:px-3.5 max-md:[&_button]:text-sm max-md:[&_button]:text-foreground",
].join(" ");

export function PaneHeader(parts: PaneHeaderParts): ReactNode {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-5 max-md:pr-14 max-md:pl-12">
      <h1 className="rounded-sm text-[15px] font-semibold" tabIndex={-1}>
        {parts.title}
      </h1>
      {parts.description !== null && parts.description !== "" && (
        <p className="truncate border-l pl-3 text-xs text-muted-foreground max-md:hidden">{parts.description}</p>
      )}
      <div className={`ml-auto shrink-0 ${HEADER_BUTTONS}`}>{parts.children}</div>
    </header>
  );
}
