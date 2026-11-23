import type { ReactNode } from "react";

export function AgentBadge(): ReactNode {
  return (
    <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-background">
      <svg className="h-[70%] w-[70%]" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 0l1.8 6.2L16 8l-6.2 1.8L8 16l-1.8-6.2L0 8l6.2-1.8z" />
      </svg>
    </span>
  );
}
