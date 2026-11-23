import { Button, ButtonRow, Muted } from "../../design-system/index.tsx";
import type { IdentityActions } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TEXT = { cancel: "Cancel" } as const;

interface DeactivateConfirmProps {
  readonly actions: IdentityActions;
  readonly name: IdentityName;
}

export function DeactivateConfirm(props: DeactivateConfirmProps): ReactNode {
  const { actions, name } = props;
  const state = useSyncExternalStore(actions.subscribe, actions.snapshot);
  const handleDeactivate = actions.deactivate;
  const handleCancel = actions.cancel;
  if (!state.confirming) {
    return null;
  }
  return (
    <>
      <Muted>{`Deactivate @${name}? Every token it holds stops working at once; its messages stay.`}</Muted>
      <ButtonRow>
        <Button onClick={handleDeactivate}>{`Deactivate @${name}`}</Button>
        <Button onClick={handleCancel}>{TEXT.cancel}</Button>
      </ButtonRow>
    </>
  );
}
