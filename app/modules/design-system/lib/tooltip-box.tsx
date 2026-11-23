import { Content } from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import type { TooltipLinesParts } from "./tooltip-parts.ts";

const OFFSET_PX = 4;

export function TooltipBox(parts: TooltipLinesParts): ReactNode {
  return (
    <Content asChild sideOffset={OFFSET_PX}>
      <div className="z-50 max-w-xs rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md">
        {parts.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </Content>
  );
}
