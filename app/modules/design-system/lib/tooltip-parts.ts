import type { Parts } from "./parts.ts";

interface TooltipLinesParts {
  readonly lines: readonly string[];
}

interface TooltipParts extends Parts, TooltipLinesParts {}

export type { TooltipLinesParts, TooltipParts };
