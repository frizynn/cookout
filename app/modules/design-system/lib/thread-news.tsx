import { AccentDot } from "./accent-dot.tsx";
import type { ReactNode } from "react";

interface ThreadNewsParts {
  readonly children: string;
  readonly forYou: boolean;
}

export function ThreadNews(parts: ThreadNewsParts): ReactNode {
  return (
    <>
      {parts.forYou && <AccentDot />}
      <span className="font-semibold text-foreground">{parts.children}</span>
    </>
  );
}
