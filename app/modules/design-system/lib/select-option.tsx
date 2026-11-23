import type { ReactNode } from "react";
import type { SelectOptionParts } from "./parts.ts";

export function SelectOption(parts: SelectOptionParts): ReactNode {
  return <option value={parts.value}>{parts.label}</option>;
}
