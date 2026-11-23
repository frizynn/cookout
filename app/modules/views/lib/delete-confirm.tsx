import { Button, ButtonRow, Muted } from "../../design-system/index.tsx";
import type { IdentityActions } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TEXT = { cancel: "Cancel" } as const;

interface DeleteConfirmProps {
  readonly actions: IdentityActions;
  readonly name: IdentityName;
}

export function DeleteConfirm(props: DeleteConfirmProps): ReactNode {
  const { actions, name } = props;
  const state = useSyncExternalStore(actions.subscribe, actions.snapshot);
  const handleDelete = actions.delete;
  const handleCancel = actions.cancel;
  if (!state.confirmingDelete) {
    return null;
  }
  return (
    <>
      <Muted>{`Delete @${name}? It has no messages; its tokens stop working and its name is free again.`}</Muted>
      <ButtonRow>
        <Button onClick={handleDelete}>{`Delete @${name}`}</Button>
        <Button onClick={handleCancel}>{TEXT.cancel}</Button>
      </ButtonRow>
    </>
  );
}
