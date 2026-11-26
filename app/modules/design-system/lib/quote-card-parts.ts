import type { ReactNode } from "react";

export interface QuoteCardParts {
  readonly href: string;
  readonly name: string;
  readonly agent: boolean;
  readonly author: string;
  readonly time: string;
  readonly fullTime: string;
  readonly where: string;
  readonly children: ReactNode;
}
