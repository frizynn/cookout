import { Button, ButtonRow, Muted } from "../../design-system/index.tsx";
import type { Identity } from "../../sdk/index.ts";
import type { IdentityActions } from "../../composer/index.ts";
import type { ReactNode } from "react";
import { deleteBody } from "./confirm-bodies.ts";
import { useSyncExternalStore } from "react";

const TEXT = { cancel: "Cancel" } as const;

interface DeleteConfirmProps {
  readonly actions: IdentityActions;
  readonly identity: Identity;
}

export function DeleteConfirm(props: DeleteConfirmProps): ReactNode {
  const { actions, identity } = props;
  const { name } = identity;
  const state = useSyncExternalStore(actions.subscribe, actions.snapshot);
  const handleDelete = actions.delete;
  const handleCancel = actions.cancel;
  if (!state.confirmingDelete) {
    return null;
  }
  return (
    <>
      <Muted>{deleteBody(identity)}</Muted>
      <ButtonRow>
        <Button onClick={handleDelete}>{`Delete @${name}`}</Button>
        <Button onClick={handleCancel}>{TEXT.cancel}</Button>
      </ButtonRow>
    </>
  );
}
