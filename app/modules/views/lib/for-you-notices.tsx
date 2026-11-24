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
  readonly deactivatedQuietAgents: Pick<DeactivatedQuietAgents, "hold" | "markRead" | "release">;
  readonly identities: Pick<Identities, "actions">;
}

interface ForYouNoticesProps {
  readonly nudges: readonly Nudge[];
  readonly offers: readonly DeactivationOffer[];
  readonly deactivated: readonly DeactivatedQuietAgent[];
  readonly held: readonly DeactivatedQuietAgent[];
  readonly actions: NoticeActions;
}

function newestFirst(entries: readonly DeactivatedQuietAgent[]): readonly DeactivatedQuietAgent[] {
  return entries.toSorted((first, second) => second.id - first.id);
}

export function ForYouNotices(props: ForYouNoticesProps): ReactNode {
  const { actions } = props;
  return (
    <>
      {newestFirst([...props.deactivated, ...props.held]).map((entry) => (
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
