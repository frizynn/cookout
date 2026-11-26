import type { FieldIds, PromptFieldParts } from "./prompt-parts.ts";
import { useId } from "react";

const CONTROL =
  "rounded-md border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-muted-foreground aria-invalid:border-destructive max-md:rounded-[10px]";

function useFieldIds(parts: PromptFieldParts): FieldIds {
  const control = useId();
  const help = `${control}-help`;
  const error = `${control}-error`;
  const described: string[] = [];
  if (parts.error !== null) {
    described.push(error);
  }
  if (parts.help !== null) {
    described.push(help);
  }
  return { control, describedBy: described.join(" "), error, help };
}

export { CONTROL, useFieldIds };
