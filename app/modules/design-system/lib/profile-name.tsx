import { NameEditButton } from "./name-edit-button.tsx";
import type { ProfileNameParts } from "./profile-parts.ts";
import type { ReactNode } from "react";

export function ProfileName(parts: ProfileNameParts): ReactNode {
  return (
    <h3 className="group/name flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-lg font-semibold">
      <span className="max-w-full truncate">{parts.displayName ?? parts.name}</span>
      {parts.edit !== null && <NameEditButton edit={parts.edit} />}
      {parts.displayName !== null && (
        <span className="max-w-full truncate text-sm font-normal text-muted-foreground">{`@${parts.name}`}</span>
      )}
      {parts.note !== null && <span className="text-sm font-normal text-muted-foreground">{parts.note}</span>}
      {parts.children}
    </h3>
  );
}
