import { PresenceDot } from "./presence-dot.tsx";
import type { PresenceShown } from "./avatar-parts.ts";
import type { ReactNode } from "react";

interface IdentityCardPresenceParts {
  readonly name: string;
  readonly presence: PresenceShown;
}

export function IdentityCardPresence(parts: IdentityCardPresenceParts): ReactNode {
  const { presence } = parts;
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <PresenceDot
        label={presence.label}
        name={parts.name}
        online={presence.online}
        place="inline"
        spoken={presence.spoken}
        warning={presence.warning}
      />
      {presence.label}
    </p>
  );
}
