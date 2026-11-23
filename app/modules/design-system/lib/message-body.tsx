import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function MessageBody(parts: Parts): ReactNode {
  return <div className="message-text text-[14.5px] leading-relaxed break-words">{parts.children}</div>;
}
