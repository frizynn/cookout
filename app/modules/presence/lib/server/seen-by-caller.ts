import { Array as Arr, Effect } from "effect";
import { Caller } from "../../../identities/server.ts";
import { HttpServerResponse } from "effect/http";
import { OfflineAlerts } from "../../../inbox/server.ts";
import type { Presence } from "../../index.ts";
import { PresenceResponseSchema } from "./wire.ts";
import type { Route } from "../../../http/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { presencePath } from "../../index.ts";

type PresenceRouteNeeds = Caller | OfflineAlerts;

function presenceRouteOn<Needs>(
  everyone: Effect.Effect<readonly Presence[], StorageUnavailable, Needs>,
): Route<Needs | PresenceRouteNeeds> {
  return {
    handle: () =>
      Effect.gen(function* answerAsCaller() {
        const caller = yield* Caller;
        const alerts = yield* OfflineAlerts;
        const presence = yield* everyone;
        const warned = yield* alerts.warningsFor(caller.name);
        return yield* HttpServerResponse.schemaJson(PresenceResponseSchema)({ presence: Arr.map(presence, warned) });
      }),
    method: "GET",
    path: presencePath,
  };
}

export { type PresenceRouteNeeds, presenceRouteOn };
