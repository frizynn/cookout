import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function Alert(parts: Parts): ReactNode {
  return (
    <div className="p-4 text-xs text-destructive" role="alert">
      {parts.children}
    </div>
  );
}
