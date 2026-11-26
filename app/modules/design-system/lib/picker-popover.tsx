import { PickerContent } from "./picker-content.tsx";
import type { PickerPopoverParts } from "./picker-parts.ts";
import { PickerTrigger } from "./picker-trigger.tsx";
import type { ReactNode } from "react";
import { Root } from "@radix-ui/react-popover";

export function PickerPopover(parts: PickerPopoverParts): ReactNode {
  const handleOpenChange = parts.onOpenChange;
  return (
    <Root onOpenChange={handleOpenChange} open={parts.open}>
      <PickerTrigger
        ids={parts.ids}
        invalid={parts.invalid}
        kind={parts.kind}
        placeholder={parts.placeholder}
        spoken={parts.spoken}
        text={parts.text}
      />
      <PickerContent label={parts.label}>{parts.children}</PickerContent>
    </Root>
  );
}
