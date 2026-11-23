import { Provider, Root, Trigger } from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import type { TooltipParts } from "./tooltip-parts.ts";
import { TooltipPortal } from "./tooltip-portal.tsx";

const DELAY_MS = 300;

export function Tooltip(parts: TooltipParts): ReactNode {
  return (
    <Provider delayDuration={DELAY_MS}>
      <Root>
        <Trigger asChild>{parts.children}</Trigger>
        <TooltipPortal lines={parts.lines} />
      </Root>
    </Provider>
  );
}
