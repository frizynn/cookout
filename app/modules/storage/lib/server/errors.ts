import type { Effect } from "effect";
import { Schema } from "effect";

export class StorageUnavailable extends Schema.TaggedError<StorageUnavailable>()("StorageUnavailable", {
  message: Schema.String,
}) {}

export type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

export function unreadable(): StorageUnavailable {
  return StorageUnavailable.make({ message: "The database holds a row this cookout can't read." });
}
