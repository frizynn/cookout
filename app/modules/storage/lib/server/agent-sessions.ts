import type { Identity, IdentityName, TokenHash } from "../../../identities/index.ts";
import { DateTime } from "effect";
import type { Effect } from "effect";
import type { IsoTime } from "../../../time/index.ts";
import type { StorageUnavailable } from "./errors.ts";
import { isoTimeOf } from "../../../time/server.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface StoredAgentSession {
  readonly hash: TokenHash;
  readonly identity: IdentityName;
  readonly issuedAt: IsoTime;
  readonly expiresAt: IsoTime;
  readonly idleSeconds: number;
}

interface IssueAgentSession {
  readonly session: StoredAgentSession;
  readonly force: boolean;
}

type IssueAgentSessionResult = { readonly status: "issued" } | { readonly status: "live"; readonly expiresAt: IsoTime };

interface UseAgentSession {
  readonly hash: TokenHash;
  readonly now: IsoTime;
}

type UseAgentSessionResult =
  | { readonly status: "active"; readonly identity: Identity; readonly expiresAt: IsoTime }
  | { readonly status: "revoked" }
  | { readonly status: "expired" }
  | { readonly status: "unknown" };

interface AgentSessionsSection {
  readonly issueAgentSession: (request: IssueAgentSession) => Fails<IssueAgentSessionResult>;
  readonly useAgentSession: (request: UseAgentSession) => Fails<UseAgentSessionResult>;
  readonly revokeAgentSession: (hash: TokenHash) => Fails<void>;
}

interface Session {
  readonly expiresAt: IsoTime;
  readonly revoked: boolean;
}

function isLive(now: IsoTime): (session: Session) => boolean {
  return (session) => !session.revoked && now < session.expiresAt;
}

interface Renewal {
  readonly now: IsoTime;
  readonly idleSeconds: number;
}

function renewedExpiry({ idleSeconds, now }: Renewal): IsoTime {
  return isoTimeOf(DateTime.add(DateTime.makeUnsafe(now), { seconds: idleSeconds }));
}

export {
  type AgentSessionsSection,
  type IssueAgentSession,
  type IssueAgentSessionResult,
  type StoredAgentSession,
  type UseAgentSession,
  type UseAgentSessionResult,
  isLive,
  renewedExpiry,
};
