import type { ButtonParts } from "./parts.ts";
import { PRIMARY_BUTTON } from "./button-look.ts";
import type { ReactNode } from "react";

export function SubmitButton(parts: Omit<ButtonParts, "onClick">): ReactNode {
  return (
    <button className={`self-start max-md:self-stretch ${PRIMARY_BUTTON}`} disabled={parts.disabled} type="submit">
      {parts.children}
    </button>
  );
}
