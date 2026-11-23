import { ActionButtons } from "./action-buttons.tsx";
import { ActionRefusal } from "./action-refusal.tsx";
import { DeactivateConfirm } from "./deactivate-confirm.tsx";
import { DeleteConfirm } from "./delete-confirm.tsx";
import type { Identities } from "../../composer/index.ts";
import type { Identity } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { SessionLine } from "./session-line.tsx";
import { TokenShown } from "./token-shown.tsx";
import { TransferForm } from "./transfer-form.tsx";

interface IdentityActionsProps {
  readonly identities: Identities;
  readonly identity: Identity;
  readonly transfer: boolean;
  readonly deletable: boolean;
}

export function IdentityActionsView(props: IdentityActionsProps): ReactNode {
  const { identity } = props;
  const actions = props.identities.actions(identity.name);
  const agent = identity.kind === "agent";
  return (
    <>
      {agent && <SessionLine actions={actions} />}
      <ActionButtons actions={actions} deletable={props.deletable} identity={identity} />
      <DeactivateConfirm actions={actions} identity={identity} />
      <DeleteConfirm actions={actions} identity={identity} />
      <TokenShown actions={actions} />
      <ActionRefusal actions={actions} />
      {agent && props.transfer && <TransferForm actions={actions} name={identity.name} />}
    </>
  );
}
