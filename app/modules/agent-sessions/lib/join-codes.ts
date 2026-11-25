import type { AgentIdentity, Token } from "../../identities/index.ts";
import type { IsoTime } from "../../time/index.ts";

export const joinCodeLifetimeMinutes = 15;

export const joinCodesPath = "/v1/join-codes";

export const redeemJoinCodePath = "/v1/join-codes/redeem";

export interface CreateJoinCodeRequest {
  readonly name: string;
  readonly description?: string;
  readonly displayName?: string;
}

export interface JoinCodeResponse {
  readonly identity: AgentIdentity;
  readonly joinCode: Token;
  readonly expiresAt: IsoTime;
}

export interface RedeemJoinCodeRequest {
  readonly joinCode: string;
  readonly idleExpiry?: string;
  readonly host?: string;
}
