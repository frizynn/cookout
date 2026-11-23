import type { CallState, ChannelMessages, Commands } from "../../board/index.ts";
import { Alert } from "../../design-system/index.tsx";
import { CallForm } from "./call-form.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const NONE = 0;

interface CommandFormProps {
  readonly call: CallState;
  readonly commands: Commands;
  readonly messages: ChannelMessages;
}

export function CommandForm(props: CommandFormProps): ReactNode {
  const { commands } = props;
  const listed = useSyncExternalStore(commands.subscribe, commands.snapshot);
  if (listed.status === "failed") {
    return <Alert>{`Couldn't list the commands (${listed.code}): ${listed.message}`}</Alert>;
  }
  if (listed.status === "loading" || listed.commands.length === NONE) {
    return null;
  }
  return <CallForm call={props.call} commands={listed.commands} messages={props.messages} />;
}
