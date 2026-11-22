import { Schema } from "effect";

export class StorageUnavailable extends Schema.TaggedError<StorageUnavailable>()("StorageUnavailable", {
  message: Schema.String,
}) {}

export function unreadable(): StorageUnavailable {
  return StorageUnavailable.make({ message: "The database holds a row this cookout can't read." });
}
