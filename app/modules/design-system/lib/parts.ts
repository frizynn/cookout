import type { ReactNode } from "react";

interface Parts {
  readonly children: ReactNode;
}

interface LinkParts extends Parts {
  readonly href: string;
}

interface ListParts extends Parts {
  readonly label: string;
}

interface SkeletonParts {
  readonly width: "short" | "long";
}

export type { LinkParts, ListParts, Parts, SkeletonParts };
