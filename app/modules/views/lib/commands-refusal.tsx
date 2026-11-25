import { Alert } from "../../design-system/content.tsx";
import type { Commands } from "../../board/index.ts";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

interface CommandsRefusalProps {
  readonly commands: Commands;
}

export function CommandsRefusal(props: CommandsRefusalProps): ReactNode {
  const { commands } = props;
  const listed = useSyncExternalStore(commands.subscribe, commands.snapshot);
  if (listed.status !== "failed") {
    return null;
  }
  return <Alert>{`Couldn't list the commands (${listed.code}): ${listed.message}`}</Alert>;
}
