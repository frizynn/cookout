import type { AgentSessionResponse, JoinRequest, LeaveResponse } from "../../agent-sessions/index.ts";
import { isAgentSessionResponse, isLeaveResponse } from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
import { agentSessionPath } from "../../agent-sessions/index.ts";
import { send } from "./request.ts";

interface AgentSessionCalls {
  readonly join: (request: JoinRequest) => Promise<AgentSessionResponse>;
  readonly leave: () => Promise<LeaveResponse>;
}

function agentSessionCalls(server: ClientConnection): AgentSessionCalls {
  return {
    join: async (body) => {
      const issued = await send(server, {
        body,
        isExpected: isAgentSessionResponse,
        method: "POST",
        path: agentSessionPath,
      });
      return issued;
    },
    leave: async () => {
      const left = await send(server, { isExpected: isLeaveResponse, method: "DELETE", path: agentSessionPath });
      return left;
    },
  };
}

export type { AgentSessionResponse, JoinRequest, LeaveResponse } from "../../agent-sessions/index.ts";
export { agentSessionCalls };
