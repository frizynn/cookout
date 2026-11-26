import type { EditAction } from "./edit-action.ts";
import type { Parts } from "./parts.ts";
import type { PresenceShown } from "./avatar-parts.ts";
import type { ReactNode } from "react";

interface ProfileParts extends Parts {
  readonly name: string;
  readonly agent: boolean;
  readonly presence: PresenceShown | null;
  readonly edit: EditAction | null;
}

interface ProfileNameParts {
  readonly name: string;
  readonly displayName: string | null;
  readonly note: string | null;
  readonly edit: EditAction | null;
  readonly children?: ReactNode;
}

export type { ProfileNameParts, ProfileParts };
