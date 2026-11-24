import { ButtonRow, RowButton } from "../../design-system/index.tsx";
import { useCallback, useMemo } from "react";
import type { DeactivatedQuietAgent } from "../../sdk/index.ts";
import { DeactivatedQuietAgentRow } from "./deactivated-quiet-agent-row.tsx";
import type { DeactivatedQuietAgents } from "../../unread/index.ts";
import type { Identities } from "../../composer/index.ts";
import { IdentityConfirm } from "./identity-confirm.tsx";
import type { ReactNode } from "react";
import { TokenShown } from "./token-shown.tsx";

const TEXT = { markRead: "Mark read", reactivate: "Reactivate" } as const;

interface UnreadDeactivatedQuietAgentRowProps {
  readonly entry: DeactivatedQuietAgent;
  readonly entries: Pick<DeactivatedQuietAgents, "hold" | "markRead" | "release">;
  readonly identities: Pick<Identities, "actions">;
}

export function UnreadDeactivatedQuietAgentRow(props: UnreadDeactivatedQuietAgentRowProps): ReactNode {
  const { entries, entry } = props;
  const shared = props.identities.actions(entry.identity.name);
  const actions = useMemo(
    () => ({
      ...shared,
      confirm: (): void => {
        entries.hold(entry.id);
        shared.confirm();
      },
      forgetToken: (): void => {
        shared.forgetToken();
        entries.release(entry.id);
      },
    }),
    [entries, entry, shared],
  );
  const handleReactivate = actions.ask.reactivate;
  const handleMarkRead = useCallback(() => {
    entries.release(entry.id);
    entries.markRead(entry.id);
  }, [entries, entry]);
  return (
    <DeactivatedQuietAgentRow entry={entry}>
      {!entry.read && (
        <ButtonRow>
          <RowButton onClick={handleReactivate}>{TEXT.reactivate}</RowButton>
          <RowButton onClick={handleMarkRead}>{TEXT.markRead}</RowButton>
        </ButtonRow>
      )}
      <TokenShown actions={actions} />
      <IdentityConfirm actions={actions} identity={entry.identity} />
    </DeactivatedQuietAgentRow>
  );
}
