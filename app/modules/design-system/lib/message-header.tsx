import type { MessageHeaderParts, MessageTimeParts } from "./parts.ts";
import { HeaderName } from "./header-name.tsx";
import { MessageTime } from "./message-time.tsx";
import type { ReactNode } from "react";
import { useNarrowScreen } from "./use-narrow-screen.ts";

const AGENT = "agent";

function shownOf(time: MessageTimeParts, narrow: boolean): string {
  if (narrow) {
    return time.short;
  }
  return time.ago;
}

export function MessageHeader(parts: MessageHeaderParts): ReactNode {
  const { time } = parts;
  const narrow = useNarrowScreen();
  return (
    <header className="flex flex-wrap items-baseline gap-x-2 max-md:flex-nowrap max-md:gap-x-1.5 max-md:[&_:has(>a)]:min-w-0 max-md:[&_a]:truncate">
      <HeaderName displayName={parts.displayName} name={parts.name} nameHref={parts.nameHref} />
      {parts.displayName !== null && (
        <span className="text-xs text-muted-foreground max-md:hidden">{`@${parts.name}`}</span>
      )}
      {parts.note !== null && <span className="text-xs text-muted-foreground">{parts.note}</span>}
      {parts.agent && (
        <span className="shrink-0 self-center rounded border px-1 py-px text-[10px] leading-none font-medium tracking-wide text-muted-foreground uppercase">
          {AGENT}
        </span>
      )}
      <MessageTime
        full={time.full}
        inGutter={false}
        iso={time.iso}
        receipt={time.receipt}
        shown={shownOf(time, narrow)}
      />
    </header>
  );
}
