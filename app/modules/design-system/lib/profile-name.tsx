import type { ProfileNameParts } from "./parts.ts";
import type { ReactNode } from "react";

export function ProfileName(parts: ProfileNameParts): ReactNode {
  return (
    <h3 className="flex min-w-0 items-center gap-2 text-lg font-semibold">
      <span className="truncate">{parts.displayName ?? parts.name}</span>
      {parts.displayName !== null && (
        <span className="truncate text-sm font-normal text-muted-foreground">{`@${parts.name}`}</span>
      )}
      {parts.note !== null && <span className="text-sm font-normal text-muted-foreground">{parts.note}</span>}
      {parts.children}
    </h3>
  );
}
