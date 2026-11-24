import type { CookoutClient, Identity, IdentityName, Token } from "../../sdk/index.ts";
import type { Identities, IdentityChange } from "./identities-slice.ts";
import type { Part } from "./slice.ts";
import type { SessionsPart } from "./agent-sessions-part.ts";

type IdentityCallsClient = Pick<
  CookoutClient,
  | "countMessagesBy"
  | "createIdentity"
  | "deactivateIdentity"
  | "deleteIdentity"
  | "makeAdmin"
  | "reactivateIdentity"
  | "removeAdmin"
  | "revokeAgentSession"
  | "rotateToken"
  | "setDescription"
  | "setDisplayName"
  | "transferAgent"
>;

interface Created {
  readonly name: IdentityName;
  readonly token: Token;
}

interface IdentityCalls {
  readonly setAdmin: (name: IdentityName, admin: boolean) => Promise<void>;
  readonly setDisplayName: (name: IdentityName, text: string | null) => Promise<void>;
  readonly setDescription: (name: IdentityName, text: string | null) => Promise<void>;
  readonly createAgent: (name: string) => Promise<Created>;
  readonly rotateToken: (name: IdentityName) => Promise<Token>;
  readonly revokeSession: (name: IdentityName) => Promise<void>;
  readonly deactivate: (name: IdentityName) => Promise<void>;
  readonly reactivate: (name: IdentityName) => Promise<Token>;
  readonly delete: (name: IdentityName) => Promise<void>;
  readonly transfer: (name: IdentityName, to: string) => Promise<void>;
  readonly countMessages: (name: IdentityName) => Promise<number>;
}

interface IdentityCallsOptions {
  readonly client: IdentityCallsClient;
  readonly identities: Pick<Part<Identities, IdentityChange>, "apply">;
  readonly sessions: Pick<SessionsPart, "put">;
}

function adminSetter({ client }: IdentityCallsOptions): (name: IdentityName, admin: boolean) => Promise<Identity> {
  return async (name, admin) => {
    if (admin) {
      const made = await client.makeAdmin(name);
      return made.identity;
    }
    const removed = await client.removeAdmin(name);
    return removed.identity;
  };
}

function textCalls(
  options: IdentityCallsOptions,
  put: (identity: Identity) => void,
): Pick<IdentityCalls, "setAdmin" | "setDescription" | "setDisplayName"> {
  const { client } = options;
  const admin = adminSetter(options);
  return {
    setAdmin: async (name, made) => {
      put(await admin(name, made));
    },
    setDescription: async (name, text) => {
      const { identity } = await client.setDescription(name, text);
      put(identity);
    },
    setDisplayName: async (name, text) => {
      const { identity } = await client.setDisplayName(name, text);
      put(identity);
    },
  };
}

function lifeCalls(
  options: IdentityCallsOptions,
  put: (identity: Identity) => void,
): Pick<IdentityCalls, "deactivate" | "delete" | "reactivate"> {
  const { client, identities, sessions } = options;
  return {
    deactivate: async (name) => {
      const { identity } = await client.deactivateIdentity(name);
      put(identity);
      sessions.put(name, []);
    },
    delete: async (name) => {
      await client.deleteIdentity(name);
      identities.apply({ name, type: "identity-removed" });
      sessions.put(name, []);
    },
    reactivate: async (name) => {
      const { identity, token } = await client.reactivateIdentity(name);
      put(identity);
      return token;
    },
  };
}

function createIdentityCalls(options: IdentityCallsOptions): IdentityCalls {
  const { client, identities, sessions } = options;
  function put(identity: Identity): void {
    identities.apply({ identity, type: "identity" });
  }
  return {
    ...textCalls(options, put),
    ...lifeCalls(options, put),
    countMessages: async (name) => {
      const { messages } = await client.countMessagesBy(name);
      return messages;
    },
    createAgent: async (name) => {
      const { identity, token } = await client.createIdentity({ kind: "agent", name });
      put(identity);
      return { name: identity.name, token };
    },
    revokeSession: async (name) => {
      await client.revokeAgentSession(name);
      sessions.put(name, []);
    },
    rotateToken: async (name) => {
      const { identity, token } = await client.rotateToken(name);
      put(identity);
      return token;
    },
    transfer: async (name, to) => {
      const { identity } = await client.transferAgent(name, to);
      put(identity);
    },
  };
}

export { type IdentityCalls, type IdentityCallsClient, createIdentityCalls };
