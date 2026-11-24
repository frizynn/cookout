import type { DeactivationOfferCalls, NudgeCalls } from "../../inbox/client.ts";
import { deactivationOfferKeepPath, nudgeReadPath } from "../../inbox/index.ts";
import { isDeactivationOfferResponse, isNudgeResponse } from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
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

function deactivationOfferCalls(server: ClientConnection): DeactivationOfferCalls {
  return {
    keepDeactivationOffer: async (offerId) => {
      const params = { id: String(offerId) };
      const kept = await send(server, {
        isExpected: isDeactivationOfferResponse,
        method: "POST",
        params,
        path: deactivationOfferKeepPath,
      });
      return kept;
    },
  };
}

export { deactivationOfferCalls, nudgeCalls };
