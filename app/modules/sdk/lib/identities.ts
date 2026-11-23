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
  identityPath,
  identityTokenPath,
  sessionPath,
  whoamiPath,
} from "../../identities/index.ts";
import { isIdentityResponse, isIdentityWithTokenResponse, isListIdentitiesResponse } from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";

type Change = "PUT" | "DELETE";

interface IdentityCalls {
  readonly whoami: () => Promise<IdentityResponse>;
  readonly login: () => Promise<IdentityResponse>;
  readonly logout: () => Promise<IdentityResponse>;
  readonly listIdentities: () => Promise<ListIdentitiesResponse>;
  readonly createIdentity: (request: CreateIdentityRequest) => Promise<IdentityWithTokenResponse>;
  readonly rotateToken: (name: string) => Promise<IdentityWithTokenResponse>;
  readonly deleteIdentity: (name: string) => Promise<IdentityResponse>;
  readonly makeAdmin: (name: string) => Promise<IdentityResponse>;
  readonly removeAdmin: (name: string) => Promise<IdentityResponse>;
}

function adminCall(server: ClientConnection, method: Change) {
  return async (name: string): Promise<IdentityResponse> => {
    const params = { name };
    const answer = await send(server, { isExpected: isIdentityResponse, method, params, path: identityAdminPath });
    return answer;
  };
}

function identityCalls(server: ClientConnection): IdentityCalls {
  return {
    createIdentity: async (body) => {
      const isExpected = isIdentityWithTokenResponse;
      const created = await send(server, { body, isExpected, method: "POST", path: identitiesPath });
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
    makeAdmin: adminCall(server, "PUT"),
    removeAdmin: adminCall(server, "DELETE"),
    rotateToken: async (name) => {
      const params = { name };
      const isExpected = isIdentityWithTokenResponse;
      const rotated = await send(server, { isExpected, method: "POST", params, path: identityTokenPath });
      return rotated;
    },
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
