import { Cancel } from "@radix-ui/react-alert-dialog";
import type { ConfirmButtonsParts } from "./confirm-parts.ts";
import type { ReactNode } from "react";

const TEXT = { cancel: "Cancel", pending: "Working…" } as const;

const CONFIRM =
  "rounded-md border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50";

function toneOf(destructive: boolean): "default" | "destructive" {
  if (destructive) {
    return "destructive";
  }
  return "default";
}

function colourOf(destructive: boolean): string {
  if (destructive) {
    return "border-destructive bg-destructive text-background";
  }
  return "bg-foreground text-background";
}

export function ConfirmButtons(parts: ConfirmButtonsParts): ReactNode {
  const handleConfirm = parts.onConfirm;
  return (
    <div className="flex items-center justify-end gap-2">
      <Cancel asChild>
        <button
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          disabled={parts.pending}
          type="button"
        >
          {TEXT.cancel}
        </button>
      </Cancel>
      <button
        aria-busy={parts.pending}
        className={`${CONFIRM} ${colourOf(parts.destructive)}`}
        data-tone={toneOf(parts.destructive)}
        disabled={parts.pending}
        onClick={handleConfirm}
        type="button"
      >
        {parts.pending && TEXT.pending}
        {!parts.pending && parts.confirm}
      </button>
    </div>
  );
}
