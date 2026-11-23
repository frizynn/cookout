import type { Command, CookoutClient, CookoutEvent } from "../../sdk/index.ts";
import type { Failure } from "./failure.ts";
import type { Live } from "../../live/index.ts";
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

interface CommandsOptions {
  readonly client: CommandsClient;
  readonly live?: Live | null;
}

function withCommand(commands: readonly Command[], changed: Command): readonly Command[] {
  const others = commands.filter((command) => command.name !== changed.name);
  return [...others, changed].toSorted((first, second) => first.name.localeCompare(second.name));
}

function createCommands({ client, live = null }: CommandsOptions): Commands {
  const listeners = new Set<() => void>();
  let state: CommandsState = { status: "loading" };
  let loading: Promise<void> | null = null;

  function publish(next: CommandsState): void {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function receive(event: CookoutEvent): void {
    if (event.type === "command" && state.status === "loaded") {
      publish({ commands: withCommand(state.commands, event.command), status: "loaded" });
    }
  }

  async function load(): Promise<void> {
    if (live !== null) {
      live.subscribe(receive);
    }
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

export { type Commands, type CommandsClient, createCommands };
