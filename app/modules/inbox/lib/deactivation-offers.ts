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

export const quietAgentDays = { deactivation: 90, offer: 30 } as const;

export const deactivationOfferKeepPath = "/v1/inbox/deactivation-offers/:id/keep";

export const deactivationOfferErrorCodes = ["deactivation_offer_not_found"] as const;

export function isDeactivationOfferId(value: number): value is DeactivationOfferId {
  return Number.isSafeInteger(value) && value >= LOWEST_ID;
}

export function deactivationOfferText({ identity, kind, quietDays }: QuietIdentity): string {
  return `@${identity} has had no activity for ${String(quietDays)} days. Deactivate ${pronouns[kind]}?`;
}

export type DeactivatedQuietAgentId = number & { readonly [brand]: "DeactivatedQuietAgentId" };

export interface DeactivatedQuietAgent {
  readonly id: DeactivatedQuietAgentId;
  readonly identity: Identity;
  readonly text: string;
  readonly deactivatedAt: IsoTime;
  readonly read: boolean;
}

export interface DeactivatedQuietAgentResponse {
  readonly deactivatedQuietAgent: DeactivatedQuietAgent;
}

export const deactivatedQuietAgentReadPath = "/v1/inbox/deactivated-quiet-agents/:id/read";

export const deactivatedQuietAgentErrorCodes = ["deactivated_quiet_agent_not_found"] as const;

export function isDeactivatedQuietAgentId(value: number): value is DeactivatedQuietAgentId {
  return Number.isSafeInteger(value) && value >= LOWEST_ID;
}

export function deactivatedQuietAgentText(agent: string): string {
  return `@${agent} was deactivated after ${String(quietAgentDays.deactivation)} days with no activity.`;
}
