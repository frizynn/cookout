import { Alert } from "../../design-system/index.tsx";
import type { IdentityActions } from "../../composer/index.ts";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const VERBS = {
  deactivate: "deactivate",
  delete: "delete",
  reactivate: "reactivate",
  revoke: "revoke the session",
  rotate: "rotate the token",
  transfer: "transfer",
} as const;

interface ActionRefusalProps {
  readonly actions: IdentityActions;
}

export function ActionRefusal(props: ActionRefusalProps): ReactNode {
  const { actions } = props;
  const { action } = useSyncExternalStore(actions.subscribe, actions.snapshot);
  if (action.status !== "failed") {
    return null;
  }
  return <Alert>{`Couldn't ${VERBS[action.action]} (${action.code}): ${action.message}`}</Alert>;
}
