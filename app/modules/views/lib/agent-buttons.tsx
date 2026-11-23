import { Button } from "../../design-system/index.tsx";
import type { IdentityActions } from "../../composer/index.ts";
import type { ListedAgentSession } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const NONE = 0;
const NO_SESSIONS: readonly ListedAgentSession[] = [];

const TEXT = { revoke: "Revoke session", rotate: "Rotate token" } as const;

interface AgentButtonsProps {
  readonly actions: IdentityActions;
}

export function AgentButtons(props: AgentButtonsProps): ReactNode {
  const { actions } = props;
  const state = useSyncExternalStore(actions.subscribe, actions.snapshot);
  const sending = state.action.status === "sending";
  const handleRotate = actions.rotate;
  const handleRevoke = actions.revokeSession;
  return (
    <>
      <Button disabled={sending} onClick={handleRotate}>
        {TEXT.rotate}
      </Button>
      {(state.sessions ?? NO_SESSIONS).length > NONE && (
        <Button disabled={sending} onClick={handleRevoke}>
          {TEXT.revoke}
        </Button>
      )}
    </>
  );
}
