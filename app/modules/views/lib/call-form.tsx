import type { CallState, ChannelMessages } from "../../board/index.ts";
import { DataArea, FieldsForm, SubmitButton } from "../../design-system/index.tsx";
import { CallRefusal } from "./call-refusal.tsx";
import type { Command } from "../../sdk/index.ts";
import { CommandSelect } from "./command-select.tsx";
import type { ReactNode } from "react";
import { useCallback } from "react";

const TEXT = { button: "Call", calling: "Calling…", data: "Data", form: "Call a command" } as const;

interface CallFormProps {
  readonly call: CallState;
  readonly commands: readonly Command[];
  readonly messages: ChannelMessages;
}

export function CallForm(props: CallFormProps): ReactNode {
  const { call } = props.messages;
  const handleCall = useCallback(
    (field: (name: string) => string) => {
      call(field("command"), field("data"));
    },
    [call],
  );
  const calling = props.call.status === "calling";
  return (
    <>
      <FieldsForm label={TEXT.form} onSubmit={handleCall}>
        <CommandSelect commands={props.commands} />
        <DataArea label={TEXT.data} name="data" />
        <SubmitButton disabled={calling}>
          {calling && TEXT.calling}
          {!calling && TEXT.button}
        </SubmitButton>
      </FieldsForm>
      <CallRefusal call={props.call} />
    </>
  );
}
