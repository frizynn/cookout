import { Alert, LineForm } from "../../design-system/index.tsx";
import type { DisplayNameDraft } from "../../composer/index.ts";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

interface DisplayNameFieldProps {
  readonly draft: DisplayNameDraft;
  readonly field: string;
  readonly label: string;
  readonly saved: string | null;
}

export function DisplayNameField(props: DisplayNameFieldProps): ReactNode {
  const { draft } = props;
  const state = useSyncExternalStore(draft.subscribe, draft.snapshot);
  const handleEdit = draft.edit;
  const handleSave = draft.save;
  const { save } = state;
  return (
    <LineForm
      field={props.field}
      label={props.label}
      onEdit={handleEdit}
      onSubmit={handleSave}
      saving={save.status === "saving"}
      value={state.text ?? props.saved ?? ""}
    >
      {save.status === "failed" && <Alert>{`Couldn't save the display name (${save.code}): ${save.message}`}</Alert>}
    </LineForm>
  );
}
