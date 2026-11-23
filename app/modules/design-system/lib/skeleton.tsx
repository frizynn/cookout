import type { ReactNode } from "react";
import type { SkeletonParts } from "./parts.ts";

const WIDTHS = { long: "w-56", short: "w-40" } as const;

export function Skeleton(parts: SkeletonParts): ReactNode {
  return <div aria-hidden="true" className={`h-4 animate-pulse rounded bg-muted ${WIDTHS[parts.width]}`} />;
}
