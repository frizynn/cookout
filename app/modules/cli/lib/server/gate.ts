import type { Caller, Identities } from "../../../identities/server.ts";
import type { Effect } from "effect";
import type { Gate } from "../../../http/server.ts";
import type { HttpServerRequest } from "effect/http";
import type { Limits } from "../../../limits/server.ts";
import type { Refusal } from "../../../http/index.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { requireToken } from "../../../identities/server.ts";
import { withinRequestLimit } from "../../../limits/server.ts";

type GateNeeds = Identities | Limits | HttpServerRequest.HttpServerRequest;

function authenticateWithinLimit<Value, Failure, Needs>(
  effect: Effect.Effect<Value, Failure, Needs>,
): Effect.Effect<Value, Failure | Refusal | StorageUnavailable, Exclude<Needs, Caller> | GateNeeds> {
  return effect.pipe(withinRequestLimit, requireToken);
}

const requireTokenWithinLimit: Gate<Caller, GateNeeds, Refusal | StorageUnavailable> = authenticateWithinLimit;

export { requireTokenWithinLimit };
