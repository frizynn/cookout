import { FileDrop } from "./file-drop.tsx";
import type { FilesHandler } from "./drop-zone.tsx";
import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";
import { useEnterMotion } from "./use-enter-motion.ts";

interface PaneParts extends Parts {
  readonly onFiles?: FilesHandler | null;
  readonly shown?: string;
}

export function Pane(parts: PaneParts): ReactNode {
  const section = useEnterMotion(parts.shown ?? "");
  return (
    <section ref={section} className="flex min-w-0 flex-1 flex-col max-md:[&:has(~aside)]:invisible">
      <FileDrop onFiles={parts.onFiles ?? null}>{parts.children}</FileDrop>
    </section>
  );
}
