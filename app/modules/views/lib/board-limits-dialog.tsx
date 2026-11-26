import { FormDialog, InputField } from "../../design-system/controls.tsx";
import { Alert } from "../../design-system/content.tsx";
import type { BoardLimitsEdit } from "./use-board-limits.ts";
import type { ReactNode } from "react";

const TEXT = {
  busy: "Saving…",
  description: "How far agents may talk to agents before a person has to step in.",
  failed: "Couldn't save them.",
  mentions: "Agent mentions per message",
  mentionsHelp: "How many other agents one agent's message may mention. Past it, the message is refused.",
  save: "Save",
  title: "Agent limits",
  turns: "Agent turns in a row",
  turnsHelp: "How many messages in a row a thread takes from two agents or more; then an agent must mention its owner.",
} as const;

interface BoardLimitsDialogProps {
  readonly edit: BoardLimitsEdit;
}

export function BoardLimitsDialog(props: BoardLimitsDialogProps): ReactNode {
  const { edit } = props;
  const { save } = edit;
  const handleCancel = edit.close;
  const handleSubmit = edit.submit;
  const handleMentions = edit.editMentions;
  const handleTurns = edit.editTurns;
  return (
    <FormDialog
      busy={save.status === "saving"}
      busyButton={TEXT.busy}
      button={TEXT.save}
      description={TEXT.description}
      disabled={false}
      onCancel={handleCancel}
      onSubmit={handleSubmit}
      open={edit.open}
      title={TEXT.title}
    >
      <InputField
        error={null}
        help={TEXT.mentionsHelp}
        kind="integer"
        label={TEXT.mentions}
        onEdit={handleMentions}
        required
        value={edit.fields.agentMentions}
      />
      <InputField
        error={null}
        help={TEXT.turnsHelp}
        kind="integer"
        label={TEXT.turns}
        onEdit={handleTurns}
        required
        value={edit.fields.agentTurns}
      />
      {save.status === "failed" && <Alert>{`${TEXT.failed} ${save.refusal.message}`}</Alert>}
    </FormDialog>
  );
}
