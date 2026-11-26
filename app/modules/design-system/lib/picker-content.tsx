import { Content, Portal } from "@radix-ui/react-popover";
import type { ReactNode } from "react";

interface PickerContentParts {
  readonly label: string;
  readonly children: ReactNode;
}

const GAP = 6;
const EDGE = 16;
const CENTER = { block: "center" } as const;

function handleOpenAutoFocus(event: Readonly<Event>): void {
  event.preventDefault();
  const start = event.target instanceof HTMLElement && event.target.querySelector('[tabindex="0"]');
  if (start instanceof HTMLElement) {
    start.scrollIntoView(CENTER);
    start.focus();
  }
}

export function PickerContent(parts: PickerContentParts): ReactNode {
  return (
    <Portal>
      <Content align="start" asChild collisionPadding={EDGE} onOpenAutoFocus={handleOpenAutoFocus} sideOffset={GAP}>
        <div
          aria-label={parts.label}
          className="z-50 rounded-lg border bg-background p-2 text-foreground shadow-lg outline-none md:origin-(--radix-popper-transform-origin) md:motion-safe:animate-pop-in"
        >
          {parts.children}
        </div>
      </Content>
    </Portal>
  );
}
