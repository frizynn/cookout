import type {
  CreateIdentityRequest,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListIdentitiesResponse,
} from "../../identities/index.ts";
import { getJson, send } from "./request.ts";
import {
  identitiesPath,
  identityAdminPath,
  identityDisplayNamePath,
  identityOwnerPath,
  identityPath,
  identityTokenPath,
  sessionPath,
  whoamiPath,
} from "../../identities/index.ts";
import {
  isHealthResponse,
  isIdentityResponse,
  isIdentityWithTokenResponse,
  isListIdentitiesResponse,
} from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
import type { HealthResponse } from "../../http/index.ts";
import { healthPath } from "../../http/index.ts";

interface IdentityCalls {
  readonly health: () => Promise<HealthResponse>;
  readonly whoami: () => Promise<IdentityResponse>;
  readonly login: () => Promise<IdentityResponse>;
  readonly logout: () => Promise<IdentityResponse>;
  readonly listIdentities: () => Promise<ListIdentitiesResponse>;
  readonly createIdentity: (request: CreateIdentityRequest) => Promise<IdentityWithTokenResponse>;
  readonly rotateToken: (name: string) => Promise<IdentityWithTokenResponse>;
  readonly deleteIdentity: (name: string) => Promise<IdentityResponse>;
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

function identityCalls(server: ClientConnection): IdentityCalls {
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
    deleteIdentity: async (name) => {
      const params = { name };
      const deleted = await send(server, {
        isExpected: isIdentityResponse,
        method: "DELETE",
        params,
        path: identityPath,
      });
      return deleted;
    },
    health: async () => {
      const healthy = await getJson(server, healthPath, isHealthResponse);
      return healthy;
    },
    listIdentities: async () => {
      const listed = await getJson(server, identitiesPath, isListIdentitiesResponse);
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

export { identityCalls };
