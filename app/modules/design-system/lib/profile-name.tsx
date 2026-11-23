import type { ProfileNameParts } from "./parts.ts";
import type { ReactNode } from "react";

export function ProfileName(parts: ProfileNameParts): ReactNode {
  return (
    <h3 className="flex items-center gap-2 text-lg font-semibold">
      <span className="truncate">{parts.name}</span>
      {parts.children}
    </h3>
  );
}
