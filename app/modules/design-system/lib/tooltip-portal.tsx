import { Portal } from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { TooltipBox } from "./tooltip-box.tsx";
import type { TooltipLinesParts } from "./tooltip-parts.ts";

export function TooltipPortal(parts: TooltipLinesParts): ReactNode {
  return (
    <Portal>
      <TooltipBox lines={parts.lines} />
    </Portal>
  );
}
