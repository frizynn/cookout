import type { BoardLimits } from "../../channels/index.ts";
import { BoardLimitsDialog } from "./board-limits-dialog.tsx";
import { Button } from "../../design-system/controls.tsx";
import type { Identities } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";
import { PageSection } from "../../design-system/layout.tsx";
import type { ReactNode } from "react";
import type { SettingsSection } from "../../paths/index.ts";
import { hrefOf } from "../../paths/index.ts";
import { isAdmin } from "./is-admin.ts";
import { useBoardLimits } from "./use-board-limits.ts";
import { useSyncExternalStore } from "react";

const TEXT = {
  edit: "Edit agent limits",
  label: "Board",
  loading: "Loading the agent limits…",
  summary: ({ agentMentions, agentTurns }: BoardLimits) =>
    `An agent's message may mention ${agentMentions} other agent(s), and a thread takes ${agentTurns} agent messages in a row before an agent has to mention its owner.`,
} as const;

interface BoardSectionProps {
  readonly identities: Identities;
  readonly me: IdentityName;
  readonly section: SettingsSection | null;
}

function summaryOf(limits: BoardLimits | null): string {
  if (limits === null) {
    return TEXT.loading;
  }
  return TEXT.summary(limits);
}

export function BoardSection(props: BoardSectionProps): ReactNode {
  const { identities } = props;
  const listed = useSyncExternalStore(identities.subscribe, identities.snapshot);
  const edit = useBoardLimits();
  const handleEdit = edit.show;
  if (!isAdmin({ identities: listed, me: props.me })) {
    return null;
  }
  return (
    <PageSection
      focused={props.section === "board"}
      href={hrefOf({ name: "settings", section: "board" })}
      label={TEXT.label}
    >
      <p className="text-sm text-muted-foreground">{summaryOf(edit.limits)}</p>
      <Button disabled={edit.limits === null} onClick={handleEdit}>
        {TEXT.edit}
      </Button>
      <BoardLimitsDialog edit={edit} />
    </PageSection>
  );
}
