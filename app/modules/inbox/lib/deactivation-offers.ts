declare const brand: unique symbol;

const LOWEST_ID = 1;

interface QuietIdentity {
  readonly identity: string;
  readonly kind: "human" | "agent";
  readonly quietDays: number;
}

const pronouns = { agent: "it", human: "them" } as const;

export type DeactivationOfferId = number & { readonly [brand]: "DeactivationOfferId" };

export const quietAgentDays = { automaticDeactivation: 90, offer: 30 } as const;

export const deactivationOfferKeepPath = "/v1/inbox/deactivation-offers/:id/keep";

export const deactivationOfferErrorCodes = ["deactivation_offer_not_found"] as const;

export function isDeactivationOfferId(value: number): value is DeactivationOfferId {
  return Number.isSafeInteger(value) && value >= LOWEST_ID;
}

export function deactivationOfferText({ identity, kind, quietDays }: QuietIdentity): string {
  return `@${identity} has had no activity for ${String(quietDays)} days. Deactivate ${pronouns[kind]}?`;
}
