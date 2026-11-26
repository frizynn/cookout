import type { FieldLabelParts } from "./prompt-parts.ts";
import type { ReactNode } from "react";

const TEXT = { required: "required" } as const;

export function FieldLabel(parts: FieldLabelParts): ReactNode {
  return (
    <span className="flex items-baseline gap-2">
      <label className="text-xs font-medium text-foreground max-md:text-[13px]" htmlFor={parts.ids.control}>
        {parts.label}
      </label>
      {parts.required && (
        <span aria-hidden className="text-[11px] text-muted-foreground">
          {TEXT.required}
        </span>
      )}
    </span>
  );
}
