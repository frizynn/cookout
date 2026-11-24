import type { DeactivatedQuietAgent, DeactivationOffer, Nudge } from "../../sdk/index.ts";
import type { DeactivatedQuietAgents, DeactivationOffers, Nudges } from "../../unread/index.ts";
import type { Identities } from "../../composer/index.ts";
import { OpenOfferRow } from "./open-offer-row.tsx";
import type { ReactNode } from "react";
import { UnreadDeactivatedQuietAgentRow } from "./unread-deactivated-quiet-agent-row.tsx";
import { UnreadNudgeRow } from "./unread-nudge-row.tsx";

interface NoticeActions {
  readonly nudges: Pick<Nudges, "close" | "markRead">;
  readonly deactivationOffers: Pick<DeactivationOffers, "keep">;
  readonly deactivatedQuietAgents: Pick<DeactivatedQuietAgents, "markRead">;
  readonly identities: Pick<Identities, "actions">;
}

interface ForYouNoticesProps {
  readonly nudges: readonly Nudge[];
  readonly offers: readonly DeactivationOffer[];
  readonly deactivated: readonly DeactivatedQuietAgent[];
  readonly actions: NoticeActions;
}

export function ForYouNotices(props: ForYouNoticesProps): ReactNode {
  const { actions } = props;
  return (
    <>
      {props.deactivated.map((entry) => (
        <UnreadDeactivatedQuietAgentRow
          entries={actions.deactivatedQuietAgents}
          entry={entry}
          identities={actions.identities}
          key={`deactivated ${String(entry.id)}`}
        />
      ))}
      {props.offers.map((offer) => (
        <OpenOfferRow
          identities={actions.identities}
          key={`offer ${String(offer.id)}`}
          offer={offer}
          offers={actions.deactivationOffers}
        />
      ))}
      {props.nudges.map((nudge) => (
        <UnreadNudgeRow key={`nudge ${String(nudge.id)}`} nudge={nudge} nudges={actions.nudges} />
      ))}
    </>
  );
}

export type { NoticeActions };
