import type { IdentityCardBoxParts } from "./identity-card-parts.ts";
import type { ReactNode } from "react";

const TEXT = { deactivated: "Deactivated" } as const;

export function IdentityCardFacts(parts: IdentityCardBoxParts): ReactNode {
  const { card } = parts;
  return (
    <>
      <p className="font-semibold">{card.displayName ?? card.name}</p>
      {card.displayName !== null && <p className="text-xs text-muted-foreground">{`@${card.name}`}</p>}
      {card.description !== null && <p className="whitespace-pre-line">{card.description}</p>}
      <p className="text-xs text-muted-foreground">{card.kind}</p>
      {card.deactivated && <p className="text-xs font-medium text-muted-foreground">{TEXT.deactivated}</p>}
    </>
  );
}
