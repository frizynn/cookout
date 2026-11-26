import { Config } from "effect";
import type { Schema } from "effect";

interface WakeSetting<Value> {
  readonly read: Schema.ConstraintCodec<Value, unknown>;
  readonly unset: Value;
}

export function wakeOptionsSetting<Value>({ read, unset }: WakeSetting<Value>): Config.Config<Value> {
  return Config.schema(read, "COOKOUT_WAKE_OPTIONS").pipe(Config.withDefault(unset));
}
