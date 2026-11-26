import { Overlay } from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";

export function ConfirmOverlay(): ReactNode {
  return (
    <Overlay asChild>
      <div className="fixed inset-0 z-50 bg-black/60 motion-safe:animate-fade-in" />
    </Overlay>
  );
}
