import { Option } from "effect";
import type { TriggerToken } from "../../../triggers/index.ts";
import { isTriggerToken } from "../../../triggers/index.ts";

function triggerToken(value: string): TriggerToken {
  return Option.getOrThrow(Option.liftPredicate(value, isTriggerToken));
}

export { triggerToken };
