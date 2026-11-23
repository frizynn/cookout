import type { ReactNode } from "react";

interface PageParts {
  readonly label: string;
  readonly children: ReactNode;
}

export function Page(parts: PageParts): ReactNode {
  return (
    <section aria-label={parts.label} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-6">{parts.children}</div>
    </section>
  );
}
