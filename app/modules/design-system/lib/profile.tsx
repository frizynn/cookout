import { Avatar } from "./avatar.tsx";
import type { ProfileParts } from "./parts.ts";
import type { ReactNode } from "react";

export function Profile(parts: ProfileParts): ReactNode {
  return (
    <div className="flex items-center gap-4 border-b px-5 py-5 max-md:flex-col max-md:items-start max-md:[&_form]:px-0">
      <Avatar agent={parts.agent} name={parts.name} presence={parts.presence} size="large" />
      <div className="flex min-w-0 flex-col gap-1 max-md:w-full max-md:gap-2">{parts.children}</div>
    </div>
  );
}
