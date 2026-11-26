import { Overlay } from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function FormDialogOverlay(): ReactNode {
  return (
    <Overlay asChild>
      <div className="fixed inset-0 z-50 bg-black/60 max-md:motion-safe:animate-fade-in" />
    </Overlay>
  );
}
