import type { Connection, End, SentWith } from "./book.ts";
import type { EndedTokens, TokensEnded } from "../../../identities/server.ts";
import { agentSessionExpired, agentSessionRevoked } from "../../../agent-sessions/index.ts";
import type { Identity } from "../../../identities/index.ts";
import type { OfflineReason } from "../../index.ts";
import { Option } from "effect";
import type { Refusal } from "../../../http/index.ts";

type Cause = TokensEnded["cause"];

const UNAUTHORIZED = 401;

const refusals: Readonly<Record<Cause, Refusal>> = {
  deactivated: {
    code: "token_revoked",
    message: "This identity was deactivated, so none of its tokens work.",
    status: UNAUTHORIZED,
  },
  left: {
    code: agentSessionRevoked,
    message: "This agent session token was revoked by leave. Join again.",
    status: UNAUTHORIZED,
  },
  revoked: {
    code: agentSessionRevoked,
    message:
      "This agent session token was revoked (by its owner, an admin, or another session's join --force). Join again.",
    status: UNAUTHORIZED,
  },
  rotated: {
    code: "token_revoked",
    message: "This token was rotated. Use the new one.",
    status: UNAUTHORIZED,
  },
};

const reasons: Readonly<Record<Cause, OfflineReason>> = {
  deactivated: "deactivated",
  left: "left",
  revoked: "session revoked",
  rotated: "token rotated",
};

const refusedReasons: ReadonlyMap<string, OfflineReason> = new Map([
  [agentSessionExpired, "session expired"],
  [agentSessionRevoked, "session revoked"],
  ["token_revoked", "deactivated"],
]);

function refusalFor(cause: Cause): Refusal {
  return refusals[cause];
}

function ownedBy(identity: Identity, by: Identity["name"]): boolean {
  return identity.kind === "agent" && identity.owner === by;
}

function causedByOwner(ended: TokensEnded, found: Option.Option<Identity>): boolean {
  return ended.by === ended.identity || Option.exists(found, (identity) => ownedBy(identity, ended.by));
}

function endOfTokens({ ended, found }: { readonly ended: TokensEnded; readonly found: Option.Option<Identity> }): End {
  return { offlineReason: reasons[ended.cause], unexpected: !causedByOwner(ended, found) };
}

function refusedEnd({ code }: Refusal): End {
  return { offlineReason: refusedReasons.get(code) ?? "session revoked", unexpected: true };
}

function sentWithSession(tokens: EndedTokens, sentWith: SentWith): boolean {
  if (sentWith.kind !== "agent session") {
    return false;
  }
  if (tokens.kind === "agent session") {
    return sentWith.hash === tokens.hash;
  }
  return tokens.kind === "agent sessions";
}

function sentWithEnded(tokens: EndedTokens): (connection: Connection) => boolean {
  return ({ sentWith }) => {
    if (tokens.kind === "all") {
      return true;
    }
    if (sentWith.kind === "identity token") {
      return tokens.kind === "identity tokens";
    }
    return sentWithSession(tokens, sentWith);
  };
}

export { endOfTokens, refusalFor, refusedEnd, sentWithEnded };
