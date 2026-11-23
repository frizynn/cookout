import { FieldsForm, SubmitButton, TextArea } from "../../design-system/index.tsx";
import { useCallback, useSyncExternalStore } from "react";
import { CallRefusal } from "./call-refusal.tsx";
import type { ChannelMessages } from "../../board/index.ts";
import type { Command } from "../../sdk/index.ts";
import { CommandSelect } from "./command-select.tsx";
import type { ReactNode } from "react";

const TEXT = { button: "Call", calling: "Calling…", data: "Data", form: "Call a command" } as const;

interface CallFormProps {
  readonly commands: readonly Command[];
  readonly messages: ChannelMessages;
}

export function CallForm(props: CallFormProps): ReactNode {
  const { messages } = props;
  const state = useSyncExternalStore(messages.subscribe, messages.snapshot);
  const { call } = messages;
  const handleCall = useCallback(
    (field: (name: string) => string) => {
      call(field("command"), field("data"));
    },
    [call],
  );
  if (state.status !== "loaded") {
    return null;
  }
  const calling = state.call.status === "calling";
  return (
    <>
      <FieldsForm label={TEXT.form} onSubmit={handleCall}>
        <CommandSelect commands={props.commands} />
        <TextArea label={TEXT.data} name="data" />
        <SubmitButton disabled={calling}>
          {calling && TEXT.calling}
          {!calling && TEXT.button}
        </SubmitButton>
      </FieldsForm>
      <CallRefusal call={state.call} />
    </>
  );
}
