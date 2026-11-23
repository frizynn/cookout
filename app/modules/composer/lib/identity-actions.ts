import type { CookoutClient, IdentityName, ListedAgentSession, Refusal, Token } from "../../sdk/index.ts";
import type { IdentityList } from "./identity-list.ts";
import type { Live } from "../../live/index.ts";
import type { SessionFollower } from "./session-follower.ts";
import { createSessionFollower } from "./session-follower.ts";
import { listenersOf } from "./listeners.ts";
import { refusalOf } from "../../sdk/index.ts";

type IdentityAction = "deactivate" | "delete" | "reactivate" | "revoke" | "rotate" | "transfer";

type ActionState =
  | { readonly status: "idle" }
  | { readonly status: "sending"; readonly action: IdentityAction }
  | (Refusal & { readonly status: "failed"; readonly action: IdentityAction });

interface IdentityActionsSnapshot {
  readonly action: ActionState;
  readonly confirming: boolean;
  readonly confirmingDelete: boolean;
  readonly messages: number | null;
  readonly sessions: readonly ListedAgentSession[] | null;
  readonly token: Token | null;
  readonly transferTo: string;
}

type ActionsClient = Pick<
  CookoutClient,
  | "countMessagesBy"
  | "deactivateIdentity"
  | "deleteIdentity"
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
  readonly subscribeToMessages: (listener: () => void) => () => void;
  readonly rotate: () => void;
  readonly revokeSession: () => void;
  readonly askToDeactivate: () => void;
  readonly askToDelete: () => void;
  readonly cancel: () => void;
  readonly deactivate: () => void;
  readonly delete: () => void;
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
  readonly live: Live | null;
  readonly name: IdentityName;
}

type Sent = Partial<Omit<IdentityActionsSnapshot, "action">>;

type Sends = Readonly<Record<IdentityAction, () => Promise<Sent>>>;

const IDLE = { status: "idle" } as const;

const START: IdentityActionsSnapshot = {
  action: IDLE,
  confirming: false,
  confirmingDelete: false,
  messages: null,
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
    delete: async () => {
      await client.deleteIdentity(name);
      list.remove(name);
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

type Sessions = IdentityActionsSnapshot["sessions"];

type Publish = (next: Partial<IdentityActionsSnapshot>) => void;

type Edits = Pick<
  IdentityActions,
  "askToDeactivate" | "askToDelete" | "cancel" | "editTransfer" | "forgetToken" | "showToken"
>;

function editsOf(publish: Publish): Edits {
  return {
    askToDeactivate: () => {
      publish({ confirming: true });
    },
    askToDelete: () => {
      publish({ confirmingDelete: true });
    },
    cancel: () => {
      publish({ confirming: false, confirmingDelete: false });
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

async function messagesOf(options: IdentityActionsOptions, publish: Publish): Promise<void> {
  try {
    const { messages } = await options.client.countMessagesBy(options.name);
    publish({ messages });
  } catch {
    publish({ messages: null });
  }
}

async function sessionsOf(options: IdentityActionsOptions, publish: Publish): Promise<Sessions> {
  try {
    const { agentSessions } = await options.client.listAgentSessions(options.name);
    publish({ sessions: agentSessions });
    return agentSessions;
  } catch {
    publish({ sessions: null });
    return null;
  }
}

function followerOf(options: IdentityActionsOptions, publish: Publish): SessionFollower {
  return createSessionFollower({
    ...options,
    load: async () => {
      const listed = await sessionsOf(options, publish);
      return listed;
    },
  });
}

type Subscribe = (listener: () => void) => () => void;

interface Loading {
  readonly add: Subscribe;
  readonly options: IdentityActionsOptions;
  readonly publish: Publish;
}

function loadingOnFirst(load: typeof messagesOf, { add, options, publish }: Loading): Subscribe {
  let loading: Promise<void> | null = null;
  return (listener) => {
    loading ??= load(options, publish);
    return add(listener);
  };
}

function createIdentityActions(options: IdentityActionsOptions): IdentityActions {
  const listeners = listenersOf(options.list.load);
  let current = START;
  let queue = Promise.resolve();
  let copying = Promise.resolve();
  const sends = sendsFor(options, () => current.transferTo);

  function publish(next: Partial<IdentityActionsSnapshot>): void {
    current = { ...current, ...next };
    listeners.notify();
  }

  const sessions = followerOf(options, publish);

  async function runAfter(previous: Promise<void>, action: IdentityAction): Promise<void> {
    await previous;
    publish({ action: { action, status: "sending" }, confirming: false, confirmingDelete: false });
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
    delete: run("delete"),
    reactivate: run("reactivate"),
    revokeSession: run("revoke"),
    rotate: run("rotate"),
    snapshot: () => current,
    subscribe: listeners.add,
    subscribeToMessages: loadingOnFirst(messagesOf, { add: listeners.add, options, publish }),
    subscribeToSessions: (listener) => {
      sessions.start();
      return listeners.add(listener);
    },
    transfer: run("transfer"),
  };
}

export { type ActionsClient, type IdentityActions, createIdentityActions };
