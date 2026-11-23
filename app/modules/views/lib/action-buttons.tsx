import { ActivationButton } from "./activation-button.tsx";
import { AgentButtons } from "./agent-buttons.tsx";
import { ButtonRow } from "../../design-system/index.tsx";
import type { Identity } from "../../sdk/index.ts";
import type { IdentityActions } from "../../composer/index.ts";
import type { ReactNode } from "react";

interface ActionButtonsProps {
  readonly actions: IdentityActions;
  readonly identity: Identity;
}

export function ActionButtons(props: ActionButtonsProps): ReactNode {
  const { actions, identity } = props;
  const active = identity.deactivated !== true;
  return (
    <ButtonRow>
      {active && identity.kind === "agent" && <AgentButtons actions={actions} />}
      <ActivationButton actions={actions} active={active} />
    </ButtonRow>
  );
}
