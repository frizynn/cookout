import { Avatar } from "./avatar.tsx";
import type { ProfileParts } from "./parts.ts";
import type { ReactNode } from "react";

export function Profile(parts: ProfileParts): ReactNode {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 gap-y-5 border-b px-5 py-5 *:col-span-2 [&_form]:p-0 [&>:nth-child(-n+2)]:col-span-1">
      <Avatar agent={parts.agent} name={parts.name} presence={parts.presence} size="large" />
      {parts.children}
    </div>
  );
}
