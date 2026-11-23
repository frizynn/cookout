import type { ReactNode } from "react";

interface SidebarBodyParts {
  readonly children: ReactNode;
  readonly onFollow: () => void;
}

export function SidebarBody(parts: SidebarBodyParts): ReactNode {
  const handleFollow = parts.onFollow;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pt-1 pb-3" onClickCapture={handleFollow}>
      {parts.children}
    </div>
  );
}
