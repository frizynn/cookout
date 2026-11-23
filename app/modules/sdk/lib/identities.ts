import type {
  CreateIdentityRequest,
  DeactivateIdentityResponse,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListIdentitiesQuery,
  ListIdentitiesResponse,
} from "../../identities/index.ts";
import { getJson, send } from "./request.ts";
import {
  identitiesPath,
  identityAdminPath,
  identityDeactivatePath,
  identityDisplayNamePath,
  identityOwnerPath,
  identityReactivatePath,
  identityTokenPath,
  sessionPath,
  whoamiPath,
} from "../../identities/index.ts";
import {
  isDeactivateIdentityResponse,
  isHealthResponse,
  isIdentityResponse,
  isIdentityWithTokenResponse,
  isListIdentitiesResponse,
} from "./generated/validators.js";
import type { AgentJoinCalls } from "../../agent-sessions/index.ts";
import type { ClientConnection } from "./request.ts";
import type { HealthResponse } from "../../http/index.ts";
import type { LoginCalls } from "../../logins/index.ts";
import { healthPath } from "../../http/index.ts";
import { loginCalls } from "./logins.ts";

interface IdentityCalls {
  readonly health: () => Promise<HealthResponse>;
  readonly whoami: () => Promise<IdentityResponse>;
  readonly login: () => Promise<IdentityResponse>;
  readonly logout: () => Promise<IdentityResponse>;
  readonly listIdentities: (query?: ListIdentitiesQuery) => Promise<ListIdentitiesResponse>;
  readonly createIdentity: (request: CreateIdentityRequest) => Promise<IdentityWithTokenResponse>;
  readonly rotateToken: (name: string) => Promise<IdentityWithTokenResponse>;
  readonly deactivateIdentity: (name: string) => Promise<DeactivateIdentityResponse>;
  readonly reactivateIdentity: (name: string) => Promise<IdentityWithTokenResponse>;
  readonly makeAdmin: (name: string) => Promise<IdentityResponse>;
  readonly removeAdmin: (name: string) => Promise<IdentityResponse>;
  readonly setDisplayName: (name: string, displayName: string | null) => Promise<IdentityResponse>;
  readonly transferAgent: (agent: string, owner: string) => Promise<IdentityResponse>;
}

function sessionCall(server: ClientConnection, method: "POST" | "DELETE") {
  return async (): Promise<IdentityResponse> => {
    const answer = await send(server, { isExpected: isIdentityResponse, method, path: sessionPath });
    return answer;
  };
}

function adminCall(server: ClientConnection, method: "PUT" | "DELETE") {
  return async (name: string): Promise<IdentityResponse> => {
    const params = { name };
    const answer = await send(server, { isExpected: isIdentityResponse, method, params, path: identityAdminPath });
    return answer;
  };
}

function setDisplayNameCall(server: ClientConnection): IdentityCalls["setDisplayName"] {
  return async (name, displayName) => {
    const answer = await send(server, {
      body: { displayName },
      isExpected: isIdentityResponse,
      method: "PUT",
      params: { name },
      path: identityDisplayNamePath,
    });
    return answer;
  };
}

function transferAgentCall(server: ClientConnection): IdentityCalls["transferAgent"] {
  return async (agent, owner) => {
    const answer = await send(server, {
      body: { owner },
      isExpected: isIdentityResponse,
      method: "PUT",
      params: { name: agent },
      path: identityOwnerPath,
    });
    return answer;
  };
}

function deactivationCalls(server: ClientConnection): Pick<IdentityCalls, "deactivateIdentity" | "reactivateIdentity"> {
  return {
    deactivateIdentity: async (name) => {
      const deactivated = await send(server, {
        isExpected: isDeactivateIdentityResponse,
        method: "POST",
        params: { name },
        path: identityDeactivatePath,
      });
      return deactivated;
    },
    reactivateIdentity: async (name) => {
      const reactivated = await send(server, {
        isExpected: isIdentityWithTokenResponse,
        method: "POST",
        params: { name },
        path: identityReactivatePath,
      });
      return reactivated;
    },
  };
}

function ownIdentityCalls(server: ClientConnection): IdentityCalls {
  return {
    createIdentity: async (body) => {
      const created = await send(server, {
        body,
        isExpected: isIdentityWithTokenResponse,
        method: "POST",
        path: identitiesPath,
      });
      return created;
    },
    ...deactivationCalls(server),
    health: async () => {
      const healthy = await getJson(server, healthPath, isHealthResponse);
      return healthy;
    },
    listIdentities: async (query = {}) => {
      const listed = await send(server, {
        isExpected: isListIdentitiesResponse,
        method: "GET",
        path: identitiesPath,
        query: { ...query },
      });
      return listed;
    },
    login: sessionCall(server, "POST"),
    logout: sessionCall(server, "DELETE"),
    makeAdmin: adminCall(server, "PUT"),
    removeAdmin: adminCall(server, "DELETE"),
    rotateToken: async (name) => {
      const rotated = await send(server, {
        isExpected: isIdentityWithTokenResponse,
        method: "POST",
        params: { name },
        path: identityTokenPath,
      });
      return rotated;
    },
    setDisplayName: setDisplayNameCall(server),
    transferAgent: transferAgentCall(server),
    whoami: async () => {
      const identity = await getJson(server, whoamiPath, isIdentityResponse);
      return identity;
    },
  };
}

function identityCalls(server: ClientConnection): IdentityCalls & LoginCalls {
  return { ...loginCalls(server), ...ownIdentityCalls(server) };
}

export type ApprovalCalls = LoginCalls & AgentJoinCalls;
export { identityCalls };
