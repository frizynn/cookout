import type {
  AgentSessionResponse,
  JoinRequest,
  LeaveResponse,
  ListAgentSessionsResponse,
  RevokeAgentSessionResponse,
} from "../../agent-sessions/index.ts";
import { agentSessionPath, identityAgentSessionPath } from "../../agent-sessions/index.ts";
import {
  isAgentSessionResponse,
  isLeaveResponse,
  isListAgentSessionsResponse,
  isRevokeAgentSessionResponse,
} from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
import { send } from "./request.ts";

interface AgentSessionCalls {
  readonly join: (request: JoinRequest) => Promise<AgentSessionResponse>;
  readonly leave: () => Promise<LeaveResponse>;
  readonly listAgentSessions: (agent: string) => Promise<ListAgentSessionsResponse>;
  readonly revokeAgentSession: (agent: string) => Promise<RevokeAgentSessionResponse>;
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
    listAgentSessions: async (agent) => {
      const listed = await send(server, {
        isExpected: isListAgentSessionsResponse,
        method: "GET",
        params: { name: agent },
        path: identityAgentSessionPath,
      });
      return listed;
    },
    revokeAgentSession: async (agent) => {
      const revoked = await send(server, {
        isExpected: isRevokeAgentSessionResponse,
        method: "DELETE",
        params: { name: agent },
        path: identityAgentSessionPath,
      });
      return revoked;
    },
  };
}

export type {
  AgentSessionResponse,
  JoinRequest,
  LeaveResponse,
  ListAgentSessionsResponse,
  ListedAgentSession,
  RevokeAgentSessionResponse,
} from "../../agent-sessions/index.ts";
export { type AgentSessionCalls, agentSessionCalls };
