import type { CookoutClient, IdentityName, ListedAgentSession, Refusal, Token } from "../../sdk/index.ts";
import type { IdentityList } from "./identity-list.ts";
import { listenersOf } from "./listeners.ts";
import { refusalOf } from "../../sdk/index.ts";

type IdentityAction = "deactivate" | "reactivate" | "revoke" | "rotate" | "transfer";

type ActionState =
  | { readonly status: "idle" }
  | { readonly status: "sending"; readonly action: IdentityAction }
  | (Refusal & { readonly status: "failed"; readonly action: IdentityAction });

interface IdentityActionsSnapshot {
  readonly action: ActionState;
  readonly confirming: boolean;
  readonly sessions: readonly ListedAgentSession[] | null;
  readonly token: Token | null;
  readonly transferTo: string;
}

type ActionsClient = Pick<
  CookoutClient,
  | "deactivateIdentity"
  | "listAgentSessions"
  | "reactivateIdentity"
  | "revokeAgentSession"
  | "rotateToken"
  | "transferAgent"
>;

interface IdentityActions {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => IdentityActionsSnapshot;
  readonly subscribeToSessions: (listener: () => void) => () => void;
  readonly rotate: () => void;
  readonly revokeSession: () => void;
  readonly askToDeactivate: () => void;
  readonly cancel: () => void;
  readonly deactivate: () => void;
  readonly reactivate: () => void;
  readonly editTransfer: (text: string) => void;
  readonly transfer: () => void;
  readonly forgetToken: () => void;
  readonly copyToken: () => void;
  readonly showToken: (token: Token) => void;
}

interface IdentityActionsOptions {
  readonly client: ActionsClient;
  readonly list: IdentityList;
  readonly name: IdentityName;
}

type Sent = Partial<Omit<IdentityActionsSnapshot, "action">>;

type Sends = Readonly<Record<IdentityAction, () => Promise<Sent>>>;

const IDLE = { status: "idle" } as const;

const START: IdentityActionsSnapshot = {
  action: IDLE,
  confirming: false,
  sessions: null,
  token: null,
  transferTo: "",
};

function markDeactivated(list: IdentityList, names: readonly IdentityName[]): void {
  for (const identity of list.identities()) {
    if (names.includes(identity.name)) {
      list.put({ ...identity, deactivated: true });
    }
  }
}

function sendsFor(options: IdentityActionsOptions, transferTo: () => string): Sends {
  const { client, list, name } = options;
  return {
    deactivate: async () => {
      const { agents, identity } = await client.deactivateIdentity(name);
      list.put(identity);
      markDeactivated(list, agents);
      return { sessions: [], token: null };
    },
    reactivate: async () => {
      const { identity, token } = await client.reactivateIdentity(name);
      list.put(identity);
      return { token };
    },
    revoke: async () => {
      await client.revokeAgentSession(name);
      return { sessions: [] };
    },
    rotate: async () => {
      const { identity, token } = await client.rotateToken(name);
      list.put(identity);
      return { token };
    },
    transfer: async () => {
      const { identity } = await client.transferAgent(name, transferTo().trim());
      list.put(identity);
      return { transferTo: "" };
    },
  };
}

type Publish = (next: Partial<IdentityActionsSnapshot>) => void;

type Edits = Pick<IdentityActions, "askToDeactivate" | "cancel" | "editTransfer" | "forgetToken" | "showToken">;

function editsOf(publish: Publish): Edits {
  return {
    askToDeactivate: () => {
      publish({ confirming: true });
    },
    cancel: () => {
      publish({ confirming: false });
    },
    editTransfer: (transferTo) => {
      publish({ transferTo });
    },
    forgetToken: () => {
      publish({ token: null });
    },
    showToken: (token) => {
      publish({ token });
    },
  };
}

async function copyAfter(previous: Promise<void>, token: Token | null): Promise<void> {
  await previous;
  if (token !== null) {
    await globalThis.navigator.clipboard.writeText(token);
  }
}

async function sessionsOf(options: IdentityActionsOptions, publish: Publish): Promise<void> {
  try {
    const { agentSessions } = await options.client.listAgentSessions(options.name);
    publish({ sessions: agentSessions });
  } catch {
    publish({ sessions: null });
  }
}

function createIdentityActions(options: IdentityActionsOptions): IdentityActions {
  const listeners = listenersOf(options.list.load);
  let current = START;
  let queue = Promise.resolve();
  let loading: Promise<void> | null = null;
  let copying = Promise.resolve();
  const sends = sendsFor(options, () => current.transferTo);

  function publish(next: Partial<IdentityActionsSnapshot>): void {
    current = { ...current, ...next };
    listeners.notify();
  }

  async function runAfter(previous: Promise<void>, action: IdentityAction): Promise<void> {
    await previous;
    publish({ action: { action, status: "sending" }, confirming: false });
    try {
      publish({ ...(await sends[action]()), action: IDLE });
    } catch (error: unknown) {
      publish({ action: { ...refusalOf(error), action, status: "failed" } });
    }
  }

  function run(action: IdentityAction): () => void {
    return () => {
      queue = runAfter(queue, action);
    };
  }

  return {
    ...editsOf(publish),
    copyToken: () => {
      copying = copyAfter(copying, current.token);
    },
    deactivate: run("deactivate"),
    reactivate: run("reactivate"),
    revokeSession: run("revoke"),
    rotate: run("rotate"),
    snapshot: () => current,
    subscribe: listeners.add,
    subscribeToSessions: (listener) => {
      loading ??= sessionsOf(options, publish);
      return listeners.add(listener);
    },
    transfer: run("transfer"),
  };
}

export { type ActionsClient, type IdentityActions, type IdentityActionsSnapshot, createIdentityActions };
