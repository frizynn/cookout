import type { CookoutClient, DeactivatedQuietAgent, DeactivationOffer, Nudge } from "../../sdk/index.ts";
import type { LiveDeactivatedQuietAgents } from "./deactivated-quiet-agents.ts";
import type { LiveDeactivationOffers } from "./deactivation-offers.ts";
import type { LiveNudges } from "./nudges.ts";
import { createDeactivatedQuietAgents } from "./deactivated-quiet-agents.ts";
import { createDeactivationOffers } from "./deactivation-offers.ts";
import { createNudges } from "./nudges.ts";

interface Notices {
  readonly nudges: LiveNudges;
  readonly deactivationOffers: LiveDeactivationOffers;
  readonly deactivatedQuietAgents: LiveDeactivatedQuietAgents;
}

type NoticesBeside =
  | { readonly nudges: readonly Nudge[] }
  | { readonly deactivationOffers: readonly DeactivationOffer[] }
  | {
      readonly deactivatedQuietAgents: readonly DeactivatedQuietAgent[];
      readonly heldDeactivatedQuietAgents: readonly DeactivatedQuietAgent[];
    };

type NoticesClient = Pick<
  CookoutClient,
  "closeThread" | "inboxHistory" | "keepDeactivationOffer" | "markDeactivatedQuietAgentRead" | "markNudgeRead"
>;

interface NoticesOptions {
  readonly client: NoticesClient;
  readonly onChange: (beside: NoticesBeside) => void;
}

function noticesOf({ client, onChange }: NoticesOptions): Notices {
  return {
    deactivatedQuietAgents: createDeactivatedQuietAgents({
      client,
      onChange: ({ held, unread }) => {
        onChange({ deactivatedQuietAgents: unread, heldDeactivatedQuietAgents: held });
      },
    }),
    deactivationOffers: createDeactivationOffers({
      client,
      onChange: (open) => {
        onChange({ deactivationOffers: open });
      },
    }),
    nudges: createNudges({
      client,
      onChange: (unread) => {
        onChange({ nudges: unread });
      },
    }),
  };
}

export type { DeactivatedQuietAgents } from "./deactivated-quiet-agents.ts";
export type { DeactivationOffers } from "./deactivation-offers.ts";
export { type Notices, type NoticesBeside, noticesOf };
