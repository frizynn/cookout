import type { DeactivationOffer, Nudge } from "../../sdk/index.ts";
import type { DeactivationOffers, Nudges } from "../../unread/index.ts";
import type { Identities } from "../../composer/index.ts";
import { OpenOfferRow } from "./open-offer-row.tsx";
import type { ReactNode } from "react";
import { UnreadNudgeRow } from "./unread-nudge-row.tsx";

interface NoticeActions {
  readonly nudges: Pick<Nudges, "close" | "markRead">;
  readonly deactivationOffers: Pick<DeactivationOffers, "keep">;
  readonly identities: Pick<Identities, "actions">;
}

interface ForYouNoticesProps {
  readonly nudges: readonly Nudge[];
  readonly offers: readonly DeactivationOffer[];
  readonly actions: NoticeActions;
}

export function ForYouNotices(props: ForYouNoticesProps): ReactNode {
  const { actions } = props;
  return (
    <>
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
