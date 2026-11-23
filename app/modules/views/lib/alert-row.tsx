import { ItemRow, Muted } from "../../design-system/index.tsx";
import type { OfflineAlert } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { useTimeAgo } from "./use-time-ago.ts";

interface AlertRowProps {
  readonly alert: OfflineAlert;
  readonly children?: ReactNode;
}

function backOnlineText(alert: OfflineAlert, ago: string): string {
  if ("backOnlineAt" in alert) {
    return `Back online ${ago}`;
  }
  return "Still offline";
}

export function AlertRow(props: AlertRowProps): ReactNode {
  const { alert } = props;
  const raised = useTimeAgo(alert.raisedAt);
  const back = useTimeAgo(alert.backOnlineAt ?? alert.raisedAt);
  return (
    <ItemRow>
      <span className="text-sm">{`@${alert.agent} went offline: ${alert.offlineReason}`}</span>
      <Muted>{`${raised} · ${backOnlineText(alert, back)}`}</Muted>
      {props.children}
    </ItemRow>
  );
}
