import type { OfflineAlert, OfflineAlertId } from "../../sdk/index.ts";
import { AlertReadButton } from "./alert-read-button.tsx";
import { AlertRow } from "./alert-row.tsx";
import type { ReactNode } from "react";

interface UnreadAlertRowProps {
  readonly alert: OfflineAlert;
  readonly onMarkRead: (id: OfflineAlertId) => void;
}

export function UnreadAlertRow(props: UnreadAlertRowProps): ReactNode {
  return (
    <AlertRow alert={props.alert}>
      <AlertReadButton id={props.alert.id} onMarkRead={props.onMarkRead} />
    </AlertRow>
  );
}
