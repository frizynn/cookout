import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./button-look.ts";
import type { ReactNode } from "react";

interface LineFormSaveParts {
  readonly saving: boolean;
  readonly submit: string;
  readonly below: boolean;
}

function classOf(below: boolean): string {
  if (below) {
    return `self-start ${PRIMARY_BUTTON}`;
  }
  return SECONDARY_BUTTON;
}

const SAVING = "Saving…";

export function LineFormSave(parts: LineFormSaveParts): ReactNode {
  return (
    <button className={classOf(parts.below)} disabled={parts.saving} type="submit">
      {parts.saving && SAVING}
      {!parts.saving && parts.submit}
    </button>
  );
}
