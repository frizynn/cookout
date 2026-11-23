import { Select, SelectOption } from "../../design-system/index.tsx";
import type { Command } from "../../sdk/index.ts";
import type { ReactNode } from "react";

const TEXT = { command: "Command" } as const;

interface CommandSelectProps {
  readonly commands: readonly Command[];
}

export function CommandSelect(props: CommandSelectProps): ReactNode {
  return (
    <Select label={TEXT.command} name="command">
      {props.commands.map(({ name }) => (
        <SelectOption key={name} label={`/${name}`} value={name} />
      ))}
    </Select>
  );
}
