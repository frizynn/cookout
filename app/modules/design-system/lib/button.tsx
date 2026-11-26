import type { ButtonParts } from "./parts.ts";
import type { ReactNode } from "react";
import { SECONDARY_BUTTON } from "./button-look.ts";
import { menuIcon } from "./menu-icons.ts";
import { useFocusOnOpen } from "./focus-on-open.ts";

export function Button(parts: ButtonParts): ReactNode {
  const { onClick } = parts;
  const button = useFocusOnOpen<HTMLButtonElement>(parts.focused === true);
  return (
    <button
      className={`self-start ${SECONDARY_BUTTON}`}
      disabled={parts.disabled}
      onClick={onClick}
      ref={button}
      type="button"
    >
      {typeof parts.icon === "string" && menuIcon(parts.icon)}
      {parts.children}
    </button>
  );
}
