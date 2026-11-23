import type {
  CreateIdentityRequest,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListIdentitiesResponse,
} from "../../identities/index.ts";
import { getJson, send } from "./request.ts";
import {
  identitiesPath,
  identityDisplayNamePath,
  identityPath,
  identityTokenPath,
  sessionPath,
  whoamiPath,
} from "../../identities/index.ts";
import { isIdentityResponse, isIdentityWithTokenResponse, isListIdentitiesResponse } from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";

interface IdentityCalls {
  readonly whoami: () => Promise<IdentityResponse>;
  readonly login: () => Promise<IdentityResponse>;
  readonly logout: () => Promise<IdentityResponse>;
  readonly listIdentities: () => Promise<ListIdentitiesResponse>;
  readonly createIdentity: (request: CreateIdentityRequest) => Promise<IdentityWithTokenResponse>;
  readonly rotateToken: (name: string) => Promise<IdentityWithTokenResponse>;
  readonly deleteIdentity: (name: string) => Promise<IdentityResponse>;
  readonly setDisplayName: (name: string, displayName: string | null) => Promise<IdentityResponse>;
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
    listIdentities: async () => {
      const listed = await getJson(server, identitiesPath, isListIdentitiesResponse);
      return listed;
    },
    login: async () => {
      const loggedIn = await send(server, { isExpected: isIdentityResponse, method: "POST", path: sessionPath });
      return loggedIn;
    },
    logout: async () => {
      const loggedOut = await send(server, { isExpected: isIdentityResponse, method: "DELETE", path: sessionPath });
      return loggedOut;
    },
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
    whoami: async () => {
      const found = await getJson(server, whoamiPath, isIdentityResponse);
      return found;
    },
  };
}

export type {
  CreateIdentityRequest,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListIdentitiesResponse,
} from "../../identities/index.ts";
export { identityCalls };
