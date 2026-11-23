import type { Live } from "../../live/index.ts";
import type { ReactNode } from "react";
import { StatusBar } from "../../design-system/index.tsx";
import { useSyncExternalStore } from "react";

const TEXT = { label: "Live link", reconnecting: "Reconnecting…" } as const;

interface ReconnectingProps {
  readonly live: Live;
}

export function ReconnectingView(props: ReconnectingProps): ReactNode {
  const { live } = props;
  const link = useSyncExternalStore(live.subscribeToLink, live.link);
  return (
    <StatusBar label={TEXT.label} shown={link === "down"}>
      {TEXT.reconnecting}
    </StatusBar>
  );
}
