import { Content } from "@radix-ui/react-dialog";
import type { FormDialogContentParts } from "./form-dialog-parts.ts";
import { FormDialogText } from "./form-dialog-text.tsx";
import { PromptButtons } from "./prompt-buttons.tsx";
import type { ReactNode } from "react";

const CENTRED =
  "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-md -translate-1/2 gap-4 overflow-y-auto overscroll-contain rounded-lg border bg-background p-5 shadow-lg";
const SHEET = [
  "max-md:top-auto max-md:bottom-[calc(100%-var(--visible-top,0px)-var(--visible-height,100%))] max-md:left-0",
  "max-md:max-h-[calc(var(--visible-height,100dvh)-env(safe-area-inset-top)-1rem)] max-md:w-full max-md:max-w-none",
  "max-md:translate-none max-md:gap-5 max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0",
  "max-md:pt-6 max-md:pb-[calc(env(safe-area-inset-bottom)+1rem)] max-md:motion-safe:animate-sheet-up",
].join(" ");

export function FormDialogContent(parts: FormDialogContentParts): ReactNode {
  const handleCancel = parts.onCancel;
  return (
    <Content asChild>
      <form action={parts.onSubmit} className={`${CENTRED} ${SHEET}`}>
        <FormDialogText description={parts.description} title={parts.title} />
        <div className="grid gap-3">{parts.children}</div>
        <PromptButtons
          busy={parts.busy}
          busyButton={parts.busyButton}
          button={parts.button}
          disabled={parts.disabled}
          onCancel={handleCancel}
        />
      </form>
    </Content>
  );
}
