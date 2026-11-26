import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function ProfileHead(parts: Parts): ReactNode {
  return <div className="flex min-w-0 flex-col gap-0.5">{parts.children}</div>;
}
