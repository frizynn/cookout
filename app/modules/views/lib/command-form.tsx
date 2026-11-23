import { Alert, CardBody, Muted } from "../../design-system/index.tsx";
import type { ChannelMessages, Commands } from "../../board/index.ts";
import { CallForm } from "./call-form.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const NONE = 0;

const TEXT = { none: "No commands are registered." } as const;

interface CommandFormProps {
  readonly commands: Commands;
  readonly messages: ChannelMessages;
}

export function CommandForm(props: CommandFormProps): ReactNode {
  const { commands } = props;
  const listed = useSyncExternalStore(commands.subscribe, commands.snapshot);
  if (listed.status === "failed") {
    return <Alert>{`Couldn't list the commands (${listed.code}): ${listed.message}`}</Alert>;
  }
  if (listed.status === "loading") {
    return null;
  }
  if (listed.commands.length === NONE) {
    return (
      <CardBody>
        <Muted>{TEXT.none}</Muted>
      </CardBody>
    );
  }
  return <CallForm commands={listed.commands} messages={props.messages} />;
}
