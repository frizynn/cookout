import type { ButtonParts } from "./parts.ts";
import { PlusIcon } from "./plus-icon.tsx";
import type { ReactNode } from "react";

export function NavButton(parts: ButtonParts): ReactNode {
  const { onClick } = parts;
  return (
    <button
      className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] text-muted-foreground hover:bg-hover hover:text-foreground disabled:opacity-50"
      disabled={parts.disabled}
      onClick={onClick}
      type="button"
    >
      <span className="flex w-4 justify-center">
        <PlusIcon />
      </span>
      {parts.children}
    </button>
  );
}
