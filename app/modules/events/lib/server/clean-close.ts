import { Caller } from "../../../identities/server.ts";
import { CleanCloseResponseSchema } from "./wire.ts";
import { Effect } from "effect";
import { HttpServerResponse } from "effect/http";
import { PresenceRegistry } from "../../../presence/server.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import { isLiveConnectionId } from "../../../presence/index.ts";
import { liveConnectionPath } from "../../index.ts";

const NOT_FOUND = 404;

function noLiveConnection(connection: string): Refusal {
  return {
    code: "not_found",
    message: `You hold no live connection ${connection}, so there is nothing to close cleanly.`,
    status: NOT_FOUND,
  };
}

const cleanClose: Route<Caller | PresenceRegistry> = {
  handle: (params) =>
    Effect.gen(function* closeLiveConnectionCleanly() {
      const caller = yield* Caller;
      const presence = yield* PresenceRegistry;
      const connection = String(params["connection"]);
      const id = Number(connection);
      const closed = isLiveConnectionId(id) && (yield* presence.closeCleanly(caller.name, id));
      if (!closed) {
        return yield* Effect.fail(noLiveConnection(connection));
      }
      return yield* HttpServerResponse.schemaJson(CleanCloseResponseSchema)({ closed: true });
    }),
  method: "DELETE",
  path: liveConnectionPath,
};

export const cleanCloseRoutes: readonly Route<Caller | PresenceRegistry>[] = [cleanClose];
