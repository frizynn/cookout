import type { Command, CookoutClient } from "../../sdk/index.ts";
import type { Failure } from "./failure.ts";
import { failure } from "./failure.ts";

type CommandsState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly commands: readonly Command[] }
  | Failure;

interface Commands {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => CommandsState;
}

type CommandsClient = Pick<CookoutClient, "listCommands">;

function createCommands(client: CommandsClient): Commands {
  const listeners = new Set<() => void>();
  let state: CommandsState = { status: "loading" };
  let loading: Promise<void> | null = null;

  function publish(next: CommandsState): void {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  }

  async function load(): Promise<void> {
    try {
      const { commands } = await client.listCommands();
      publish({ commands, status: "loaded" });
    } catch (error: unknown) {
      publish(failure(error));
    }
  }

  return {
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      loading ??= load();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type Commands, type CommandsClient, type CommandsState, createCommands };
