import type { ReactNode } from "react";

interface TokenTextParts {
  readonly label: string;
  readonly token: string;
}

export function TokenText(parts: TokenTextParts): ReactNode {
  return (
    <code aria-label={parts.label} className="rounded-md border bg-surface px-2 py-1 font-mono text-xs break-all">
      {parts.token}
    </code>
  );
}
