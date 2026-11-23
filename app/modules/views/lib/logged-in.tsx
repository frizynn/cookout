import { LinkList, LinkRow, Muted } from "../../design-system/index.tsx";
import type { ReactNode } from "react";

const TEXT = { channels: "See the channels", next: "Next" } as const;

interface LoggedInProps {
  readonly name: string;
}

export function LoggedIn(props: LoggedInProps): ReactNode {
  return (
    <LinkList label={TEXT.next}>
      <LinkRow href="#/">
        <Muted>{`Logged in as @${props.name}.`}</Muted>
        <span className="text-sm">{TEXT.channels}</span>
      </LinkRow>
    </LinkList>
  );
}
