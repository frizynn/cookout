import type { AddCommandRequest, CommandWithSecretResponse, ListCommandsResponse } from "../../commands/index.ts";
import { isCommandWithSecretResponse, isListCommandsResponse } from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
import { commandsPath } from "../../commands/index.ts";
import { send } from "./request.ts";

interface CommandCalls {
  readonly addCommand: (request: AddCommandRequest) => Promise<CommandWithSecretResponse>;
  readonly listCommands: () => Promise<ListCommandsResponse>;
}

function commandCalls(server: ClientConnection): CommandCalls {
  return {
    addCommand: async (body) => {
      const added = await send(server, {
        body,
        isExpected: isCommandWithSecretResponse,
        method: "POST",
        path: commandsPath,
      });
      return added;
    },
    listCommands: async () => {
      const listed = await send(server, { isExpected: isListCommandsResponse, method: "GET", path: commandsPath });
      return listed;
    },
  };
}

export type { AddCommandRequest, CommandWithSecretResponse, ListCommandsResponse } from "../../commands/index.ts";
export { commandCalls };
