import type { ClientConnection } from "./request.ts";
import type { NudgeCalls } from "../../inbox/client.ts";
import { isNudgeResponse } from "./generated/validators.js";
import { nudgeReadPath } from "../../inbox/index.ts";
import { send } from "./request.ts";

function nudgeCalls(server: ClientConnection): NudgeCalls {
  return {
    markNudgeRead: async (nudgeId) => {
      const params = { id: String(nudgeId) };
      const read = await send(server, { isExpected: isNudgeResponse, method: "POST", params, path: nudgeReadPath });
      return read;
    },
  };
}

export { nudgeCalls };
