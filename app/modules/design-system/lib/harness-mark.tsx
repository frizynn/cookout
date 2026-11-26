import { HARNESS_BRANDS } from "./harness-brands.ts";
import type { ReactNode } from "react";

interface HarnessMarkParts {
  readonly name: string;
}

const TILE = "flex size-8 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-foreground/10";

export function HarnessMark(parts: HarnessMarkParts): ReactNode {
  const brand = HARNESS_BRANDS[parts.name];
  const [initial = ""] = parts.name;
  if (typeof brand !== "object") {
    return (
      <span aria-hidden className={`${TILE} bg-muted text-sm font-semibold text-muted-foreground`}>
        {initial.toUpperCase()}
      </span>
    );
  }
  return (
    <span aria-hidden className={`${TILE} ${brand.tile}`}>
      <svg className="size-[18px] fill-white" viewBox="0 0 24 24">
        <path d={brand.glyph} />
      </svg>
    </span>
  );
}
