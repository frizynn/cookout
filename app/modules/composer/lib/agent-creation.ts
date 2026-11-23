import type { CookoutClient, IdentityName, Refusal, Token } from "../../sdk/index.ts";
import type { IdentityList } from "./identity-list.ts";
import { listenersOf } from "./listeners.ts";
import { refusalOf } from "../../sdk/index.ts";

type CreateState =
  | { readonly status: "idle" }
  | { readonly status: "creating" }
  | (Refusal & { readonly status: "failed" });

interface AgentCreationSnapshot {
  readonly text: string;
  readonly create: CreateState;
}

interface AgentCreation {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => AgentCreationSnapshot;
  readonly edit: (text: string) => void;
  readonly create: () => void;
}

interface AgentCreationOptions {
  readonly client: Pick<CookoutClient, "createIdentity">;
  readonly list: IdentityList;
  readonly created: (name: IdentityName, token: Token) => void;
}

function createAgentCreation(options: AgentCreationOptions): AgentCreation {
  const listeners = listenersOf(options.list.load);
  let current: AgentCreationSnapshot = { create: { status: "idle" }, text: "" };
  let queue = Promise.resolve();

  function publish(next: AgentCreationSnapshot): void {
    current = next;
    listeners.notify();
  }

  async function sendAfter(previous: Promise<void>, text: string): Promise<void> {
    await previous;
    try {
      const { identity, token } = await options.client.createIdentity({ kind: "agent", name: text.trim() });
      options.list.put(identity);
      options.created(identity.name, token);
      publish({ create: { status: "idle" }, text: "" });
    } catch (error: unknown) {
      publish({ create: { ...refusalOf(error), status: "failed" }, text });
    }
  }

  return {
    create: () => {
      const { text } = current;
      publish({ create: { status: "creating" }, text });
      queue = sendAfter(queue, text);
    },
    edit: (text) => {
      publish({ ...current, text });
    },
    snapshot: () => current,
    subscribe: listeners.add,
  };
}

export { type AgentCreation, createAgentCreation };
