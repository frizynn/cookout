import { ActivationButton } from "./activation-button.tsx";
import { Button } from "../../design-system/index.tsx";
import type { IdentityActions } from "../../composer/index.ts";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const NO_MESSAGES = 0;

const TEXT = { delete: "Delete" } as const;

interface RemovalButtonProps {
  readonly actions: IdentityActions;
  readonly active: boolean;
  readonly deletable: boolean;
}

function subscriptionOf(props: RemovalButtonProps): IdentityActions["subscribe"] {
  if (props.active && props.deletable) {
    return props.actions.subscribeToMessages;
  }
  return props.actions.subscribe;
}

export function RemovalButton(props: RemovalButtonProps): ReactNode {
  const { actions } = props;
  const state = useSyncExternalStore(subscriptionOf(props), actions.snapshot);
  const handleDelete = actions.askToDelete;
  if (!props.active || !props.deletable || state.messages !== NO_MESSAGES) {
    return <ActivationButton actions={actions} active={props.active} />;
  }
  return (
    <Button disabled={state.action.status === "sending" || state.confirmingDelete} onClick={handleDelete}>
      {TEXT.delete}
    </Button>
  );
}
