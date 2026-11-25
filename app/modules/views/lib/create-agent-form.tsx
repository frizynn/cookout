import type { AgentCreation } from "../../composer/index.ts";
import { Alert } from "../../design-system/content.tsx";
import { LineForm } from "../../design-system/controls.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TEXT = { field: "New agent's name", label: "Create an agent", submit: "Create" } as const;

interface CreateAgentFormProps {
  readonly creation: AgentCreation;
}

export function CreateAgentForm(props: CreateAgentFormProps): ReactNode {
  const { creation } = props;
  const state = useSyncExternalStore(creation.subscribe, creation.snapshot);
  const handleEdit = creation.edit;
  const handleCreate = creation.create;
  const { create } = state;
  return (
    <LineForm
      field={TEXT.field}
      label={TEXT.label}
      onEdit={handleEdit}
      onSubmit={handleCreate}
      saving={create.status === "creating"}
      submit={TEXT.submit}
      value={state.text}
    >
      {create.status === "failed" && <Alert>{`Couldn't create the agent (${create.code}): ${create.message}`}</Alert>}
    </LineForm>
  );
}
