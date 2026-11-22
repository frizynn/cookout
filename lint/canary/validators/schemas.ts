import { Schema } from "effect";

export const canaryResponseSchemas = {
  UniqueTags: Schema.Struct({
    tags: Schema.Array(Schema.Struct({ name: Schema.String })).check(Schema.isUnique()),
  }),
};
