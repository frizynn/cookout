import type { Identity } from "../../identities/index.ts";
import type { IsoTime } from "../../time/index.ts";

declare const brand: unique symbol;

const LOWEST_ID = 1;

interface QuietIdentity {
  readonly identity: string;
  readonly kind: "human" | "agent";
  readonly quietDays: number;
}

const pronouns = { agent: "it", human: "them" } as const;

export type DeactivationOfferId = number & { readonly [brand]: "DeactivationOfferId" };

export interface DeactivationOffer {
  readonly id: DeactivationOfferId;
  readonly identity: Identity;
  readonly quietDays: number;
  readonly text: string;
  readonly raisedAt: IsoTime;
  readonly cleared: boolean;
}

export interface DeactivationOfferResponse {
  readonly deactivationOffer: DeactivationOffer;
}

export const quietAgentDays = { automaticDeactivation: 90, offer: 30 } as const;

export const deactivationOfferKeepPath = "/v1/inbox/deactivation-offers/:id/keep";

export const deactivationOfferErrorCodes = ["deactivation_offer_not_found"] as const;

export function isDeactivationOfferId(value: number): value is DeactivationOfferId {
  return Number.isSafeInteger(value) && value >= LOWEST_ID;
}

export function deactivationOfferText({ identity, kind, quietDays }: QuietIdentity): string {
  return `@${identity} has had no activity for ${String(quietDays)} days. Deactivate ${pronouns[kind]}?`;
}

export type AutomaticDeactivationId = number & { readonly [brand]: "AutomaticDeactivationId" };

export interface AutomaticDeactivation {
  readonly id: AutomaticDeactivationId;
  readonly identity: Identity;
  readonly text: string;
  readonly deactivatedAt: IsoTime;
  readonly read: boolean;
}

export interface AutomaticDeactivationResponse {
  readonly automaticDeactivation: AutomaticDeactivation;
}

export const automaticDeactivationReadPath = "/v1/inbox/automatic-deactivations/:id/read";

export const automaticDeactivationErrorCodes = ["automatic_deactivation_not_found"] as const;

export function isAutomaticDeactivationId(value: number): value is AutomaticDeactivationId {
  return Number.isSafeInteger(value) && value >= LOWEST_ID;
}

export function automaticDeactivationText(agent: string): string {
  return `@${agent} was deactivated after ${String(quietAgentDays.automaticDeactivation)} days with no activity.`;
}
