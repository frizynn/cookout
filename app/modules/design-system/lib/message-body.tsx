import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function MessageBody(parts: Parts): ReactNode {
  return <p className="text-[14.5px] leading-relaxed break-words whitespace-pre-wrap">{parts.children}</p>;
}
