import type { FieldNotesParts } from "./prompt-parts.ts";
import type { ReactNode } from "react";

export function FieldNotes(parts: FieldNotesParts): ReactNode {
  return (
    <>
      {parts.error !== null && (
        <span className="text-xs text-destructive" id={parts.ids.error}>
          {parts.error}
        </span>
      )}
      {parts.help !== null && (
        <span className="text-xs text-muted-foreground" id={parts.ids.help}>
          {parts.help}
        </span>
      )}
    </>
  );
}
