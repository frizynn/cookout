import { Button, ButtonRow, Muted } from "../../design-system/index.tsx";
import type { Identity } from "../../sdk/index.ts";
import type { IdentityActions } from "../../composer/index.ts";
import type { ReactNode } from "react";
import { deactivateBody } from "./confirm-bodies.ts";
import { useSyncExternalStore } from "react";

const TEXT = { cancel: "Cancel" } as const;

interface DeactivateConfirmProps {
  readonly actions: IdentityActions;
  readonly identity: Identity;
}

export function DeactivateConfirm(props: DeactivateConfirmProps): ReactNode {
  const { actions, identity } = props;
  const { name } = identity;
  const state = useSyncExternalStore(actions.subscribe, actions.snapshot);
  const handleDeactivate = actions.deactivate;
  const handleCancel = actions.cancel;
  if (!state.confirming) {
    return null;
  }
  return (
    <>
      <Muted>{deactivateBody(identity)}</Muted>
      <ButtonRow>
        <Button onClick={handleDeactivate}>{`Deactivate @${name}`}</Button>
        <Button onClick={handleCancel}>{TEXT.cancel}</Button>
      </ButtonRow>
    </>
  );
}
