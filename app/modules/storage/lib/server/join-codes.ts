import type { IdentityName, TokenHash } from "../../../identities/index.ts";
import type { IssueAgentSession, IssueAgentSessionResult } from "./agent-sessions.ts";
import type { Fails } from "./errors.ts";
import type { IsoTime } from "../../../time/index.ts";
import { Predicate } from "effect";
import { renewedExpiry } from "./agent-sessions.ts";

interface NewJoinCode {
  readonly codeHash: TokenHash;
  readonly agent: IdentityName;
  readonly createdAt: IsoTime;
  readonly expiresAt: IsoTime;
}

interface RedeemJoinCode {
  readonly codeHash: TokenHash;
  readonly sessionHash: TokenHash;
  readonly idleSeconds: number;
  readonly now: IsoTime;
  readonly host?: string;
}

type JoinCodeRedemption =
  | { readonly status: "gone" }
  | { readonly status: "deactivated"; readonly identity: IdentityName }
  | { readonly status: "live"; readonly identity: IdentityName; readonly expiresAt: IsoTime }
  | {
      readonly status: "redeemed";
      readonly identity: IdentityName;
      readonly issuedAt: IsoTime;
      readonly expiresAt: IsoTime;
    };

interface JoinCodesSection {
  readonly addJoinCode: (code: NewJoinCode) => Fails<void>;
  readonly redeemJoinCode: (redeem: RedeemJoinCode) => Fails<JoinCodeRedemption>;
}

const GONE: JoinCodeRedemption = { status: "gone" };

interface Redeeming {
  readonly agent: IdentityName;
  readonly redeem: RedeemJoinCode;
}

interface Issued {
  readonly issue: IssueAgentSession;
  readonly result: IssueAgentSessionResult;
}

function sessionFor({ agent, redeem }: Redeeming): IssueAgentSession {
  const { host, idleSeconds, now, sessionHash } = redeem;
  const expiresAt = renewedExpiry({ idleSeconds, now });
  const session = { expiresAt, hash: sessionHash, identity: agent, idleSeconds, issuedAt: now };
  if (Predicate.isUndefined(host)) {
    return { force: false, session };
  }
  return { force: false, session: { ...session, host } };
}

function redemptionOf({ issue, result }: Issued): JoinCodeRedemption {
  const { expiresAt, identity, issuedAt } = issue.session;
  if (result.status === "live") {
    return { expiresAt: result.expiresAt, identity, status: "live" };
  }
  return { expiresAt, identity, issuedAt, status: "redeemed" };
}

export { GONE, redemptionOf, sessionFor };

export type { JoinCodeRedemption, JoinCodesSection, NewJoinCode, RedeemJoinCode };
