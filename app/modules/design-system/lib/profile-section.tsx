import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function ProfileSection(parts: Parts): ReactNode {
  return <div className="flex flex-col gap-3 border-t pt-5 empty:hidden">{parts.children}</div>;
}
