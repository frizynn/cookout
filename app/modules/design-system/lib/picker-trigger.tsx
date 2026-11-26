import { CONTROL } from "./field-ids.ts";
import { PickerIcon } from "./picker-icon.tsx";
import type { PickerTriggerParts } from "./picker-parts.ts";
import type { ReactNode } from "react";
import { Trigger } from "@radix-ui/react-popover";

function textLook(text: string | null): string {
  if (text === null) {
    return "text-muted-foreground";
  }
  return "text-foreground";
}

export function PickerTrigger(parts: PickerTriggerParts): ReactNode {
  return (
    <Trigger asChild>
      <button
        aria-describedby={parts.ids.describedBy}
        aria-label={parts.spoken}
        className={`${CONTROL} flex cursor-pointer items-center gap-2 text-left data-[invalid=true]:border-destructive data-[state=open]:border-muted-foreground`}
        data-invalid={parts.invalid}
        id={parts.ids.control}
        type="button"
      >
        <PickerIcon kind={parts.kind} />
        <span className={`truncate ${textLook(parts.text)}`}>{parts.text ?? parts.placeholder}</span>
      </button>
    </Trigger>
  );
}
