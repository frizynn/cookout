import { Effect, Predicate } from "effect";
import { GONE, redemptionOf, sessionFor } from "./join-codes.ts";
import type { JoinCodeRedemption, JoinCodesSection, NewJoinCode, RedeemJoinCode } from "./join-codes.ts";
import type { AgentSessionsSection } from "./agent-sessions.ts";
import type { Fails } from "./errors.ts";
import type { FindIdentity } from "./identity-row.ts";
import type { MemoryState } from "./memory-state.ts";
import type { TokenHash } from "../../../identities/index.ts";

interface MemoryJoinCodesOptions {
  readonly state: MemoryState;
  readonly findIdentity: FindIdentity;
  readonly issueAgentSession: AgentSessionsSection["issueAgentSession"];
}

function memoryJoinCodes({ findIdentity, issueAgentSession, state }: MemoryJoinCodesOptions): JoinCodesSection {
  const codes = new Map<TokenHash, NewJoinCode>();
  function redeemFound(code: NewJoinCode, redeem: RedeemJoinCode): Fails<JoinCodeRedemption> {
    const agent = findIdentity(code.agent);
    if (Predicate.isUndefined(agent)) {
      return Effect.succeed(GONE);
    }
    if (agent.deactivated === true) {
      return Effect.succeed({ identity: code.agent, status: "deactivated" });
    }
    const issue = sessionFor({ agent: code.agent, redeem });
    return Effect.map(issueAgentSession(issue), (result) => {
      if (result.status === "issued") {
        codes.delete(redeem.codeHash);
      }
      return redemptionOf({ issue, result });
    });
  }
  return {
    addJoinCode: (code) =>
      Effect.andThen(
        state.ensureOpen,
        Effect.sync(() => {
          codes.set(code.codeHash, { ...code });
        }),
      ),
    redeemJoinCode: (redeem) =>
      Effect.andThen(
        state.ensureOpen,
        Effect.suspend(() => {
          const code = codes.get(redeem.codeHash);
          if (Predicate.isUndefined(code) || redeem.now >= code.expiresAt) {
            codes.delete(redeem.codeHash);
            return Effect.succeed(GONE);
          }
          return redeemFound(code, redeem);
        }),
      ),
  };
}

export { memoryJoinCodes };
