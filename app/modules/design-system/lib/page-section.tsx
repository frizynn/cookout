import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

interface PageSectionParts {
  readonly label: string;
  readonly href: string;
  readonly focused: boolean;
  readonly children: ReactNode;
}

export function PageSection(parts: PageSectionParts): ReactNode {
  const { focused } = parts;
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = heading.current;
    if (focused && element !== null) {
      element.focus();
    }
  }, [focused]);
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 className="border-b pb-2 text-sm font-semibold outline-none" id={id} ref={heading} tabIndex={-1}>
        <a className="hover:underline" href={parts.href}>
          {parts.label}
        </a>
      </h2>
      {parts.children}
    </section>
  );
}
